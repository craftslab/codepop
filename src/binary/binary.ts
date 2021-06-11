// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as extract from "extract-zip";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as semver from "semver";
import * as url from "url";
import * as vscode from "vscode";
import HttpsProxyAgent from "https-proxy-agent/dist/agent";
import { ClientRequest, IncomingMessage } from "http";
import { ProgressLocation, window } from "vscode";
import { promises } from "fs";
import { workspace } from "vscode";
import { binaryUrl, brandName } from '../proto/proto';

const EXECUTABLE_FLAG = 0o755;

type FilePaths = {
    filePath: string;
    fileUrl: string;
    fileDir: string;
    execPath: string;
};

type ProxyAgentSettings = {
    agent: HttpsProxyAgent | undefined;
    rejectUnauthorized: boolean;
};

export default class Binary {
    private root: string | undefined;

    public init(context: vscode.ExtensionContext): Promise<void> {
        this.root = path.join(context.globalStorageUri.fsPath, "binary");
        try {
            // @ts-ignore
            fs.mkdir(this.root, {recursive: true});
        } catch (err) {
            // PASS
        }
        return Promise.resolve();
    }

    public async fetch(): Promise<string> {
        const path = this.handleFile();
        if (path) {
            return path;
        }
        return this.downloadVersion();
    }

    private handleFile(): string | null {
        try {
            const activePath = this.getActivePath();
            if (fs.existsSync(activePath)) {
                const version = fs.readFileSync(activePath, "utf-8").trim();
                const versionPath = this.versionPath(version);
                if (fs.existsSync(versionPath)) {
                    return versionPath;
                }
            }
        } catch (e) {
            // PASS
        }
        return null;
    }

    private getActivePath(): string {
        if (!this.root) {
            throw new Error("Root not set");
        }
        return path.join(this.root, "active");
    }

    private versionPath(version: string): string {
        if (!this.root) {
            throw new Error("Root not set");
        }
        return path.join(this.root, version, `${Binary.getArch()}-${Binary.getPlatform()}`);
    }

    private static getArch(): string {
        if (process.platform === "darwin" && process.arch === "arm64") {
            return "aarch64";
        }
        if (process.arch === "x32" || process.arch === "ia32") {
            return "i686";
        }
        if (process.arch === "x64") {
            return "x86_64";
        }
        throw new Error(
            `'${process.arch}' not supported`
        );
    }

    private static getPlatform(): string {
        switch (process.platform) {
            case "win32":
                return `windows/'${brandName}'.exe`;
            case "darwin":
                return `darwin/'${brandName}'`;
            case "linux":
                return `linux/'${brandName}'`;
            default:
                throw new Error(
                    `'${process.platform}' not supported`
                );
        }
    }

    private async downloadVersion(): Promise<string> {
        return window.withProgress(
            {
                location: ProgressLocation.Notification,
                title: `Initializing '${brandName}'`,
            },
            this.downloadAndExtract
        );
    }

    private async downloadAndExtract(): Promise<string> {
        const {
            filePath,
            fileUrl,
            fileDir,
            execPath,
        } = await this.getFilePaths();
        try {
            await this.downloadFile(fileUrl, filePath);
            await Binary.extractBundle(filePath, fileDir);
            await Binary.removeBundle(filePath);
            await this.setExecutable(fileDir);
            return execPath;
        } finally {
            await Binary.removeBundle(filePath);
        }
    }

    private async getFilePaths(): Promise<FilePaths> {
        const version = await this.getVersion();
        const filePath = this.versionPath(version);
        const fileUrl = Binary.getUrl(version);
        const fileDir = path.dirname(filePath);
        const execPath = this.versionPath(version);
        return { filePath, fileUrl, fileDir, execPath };
    }

    private async getVersion(): Promise<string> {
        const version = await this.downloadData(binaryUrl);
        Binary.assertVersion(version);
        return version;
    }

    private static assertVersion(version: string): void {
        if (!semver.valid(version)) {
            throw new Error(`invalid version: ${version}`);
        }
    }

    private static getUrl(version: string): string {
        return `${binaryUrl}/${Binary.getArch()}-${Binary.getPlatform()}`;
    }

    private downloadData(urlStr: string): Promise<string> {
        return this.downloadResource(urlStr, (response, resolve, reject) => {
            let downloadedData = "";
            response.on("data", (data) => {
                downloadedData += data;
            });
            response.on("error", (error) => {
                reject(error);
            });
            response.on("end", () => {
                resolve(downloadedData);
            });
        });
    }

    private downloadFile(
        url: string,
        dest: string
    ): Promise<void> {
        return this.downloadResource(url, (response, resolve, reject) => {
            const createdFile: fs.WriteStream = fs.createWriteStream(dest);
            createdFile.on("finish", () => {
                resolve();
            });
            response.on("error", (error) => {
                reject(error);
            });
            response.pipe(createdFile);
        });
    }

    private downloadResource<T>(
        urlStr: string,
        callback: (
            response: IncomingMessage,
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (error: Error) => void
        ) => void
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const parsedUrl = url.parse(urlStr);
            const { agent, rejectUnauthorized } = Binary.getHttpsProxyAgent();
            const request: ClientRequest = https.request(
                {
                    host: parsedUrl.host,
                    path: parsedUrl.path,
                    port: Binary.getPortNumber(parsedUrl),
                    agent,
                    rejectUnauthorized,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    headers: { "User-Agent": "TabNine.tabnine-vscode" },
                },
                (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        let redirectUrl: string;
                        if (typeof response.headers.location === "string") {
                            redirectUrl = response.headers.location;
                        } else {
                            if (!response.headers.location || response.headers.location) {
                                return reject(new Error("Invalid download location received"));
                            }
                            [redirectUrl] = response.headers.location as string[];
                        }
                        return resolve(this.downloadResource(redirectUrl, callback));
                    }
                    if (response.statusCode !== 200 && response.statusCode !== 403) {
                        return reject(
                            new Error(`Failed request statusCode ${response.statusCode || ""}`)
                        );
                    }
                    callback(response, resolve, reject);
                    response.on("error", (error) => {
                        reject(error);
                    });
                    return undefined;
                }
            );
            request.on("error", (error) => {
                reject(error);
            });
            request.end();
        });
    }

    private static getHttpsProxyAgent(): ProxyAgentSettings {
        const proxySettings = Binary.getProxySettings();
        if (!proxySettings) {
            return { agent: undefined, rejectUnauthorized: false };
        }
        const proxyUrl = url.parse(proxySettings);
        if (proxyUrl.protocol !== "https:" && proxyUrl.protocol !== "http:") {
            return { agent: undefined, rejectUnauthorized: false };
        }
        const rejectUnauthorized = workspace
            .getConfiguration()
            .get("http.proxyStrictSSL", true);
        const parsedPort: number | undefined = proxyUrl.port
            ? parseInt(proxyUrl.port, 10)
            : undefined;
        const port = Number.isNaN(parsedPort) ? undefined : parsedPort;
        const proxyOptions = {
            host: proxyUrl.hostname,
            port,
            auth: proxyUrl.auth,
            rejectUnauthorized,
        };
        return {
            agent: new HttpsProxyAgent(proxyOptions),
            rejectUnauthorized,
        };
    }

    private static getProxySettings(): string | undefined {
        let proxy: string | undefined = workspace
            .getConfiguration()
            .get<string>("http.proxy");
        if (!proxy) {
            proxy =
                process.env.HTTPS_PROXY ||
                process.env.https_proxy ||
                process.env.HTTP_PROXY ||
                process.env.http_proxy;
        }
        return proxy;
    }

    private static getPortNumber(
        parsedUrl: url.UrlWithStringQuery
    ): string | number | undefined {
        return (
            (parsedUrl.port && Number(parsedUrl.port)) ||
            (parsedUrl.protocol === "https:" ? 443 : 80)
        );
    }

    private static async extractBundle(
        path: string,
        dir: string
    ): Promise<void> {
        return extract(path, { dir: dir});
    }

    private static async removeBundle(path: string) {
        try {
            await promises.unlink(path);
            // eslint-disable-next-line no-empty
        } catch {}
    }

    private async setExecutable(
        dir: string
    ): Promise<void[]> {
        if (Binary.isWindows()) {
            return Promise.resolve([]);
        }
        const files = await promises.readdir(dir);
        return Promise.all(
            files.map((file) =>
                promises.chmod(path.join(dir, file), EXECUTABLE_FLAG)
            )
        );
    }

    private static isWindows(): boolean {
        return process.platform === "win32";
    }
}
