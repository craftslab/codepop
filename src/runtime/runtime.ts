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

import * as child_process from 'child_process';
import { createInterface, ReadLine, ReadLineOptions } from "readline";
import { Mutex } from 'await-semaphore';
import { spawn } from "child_process";

type UnkownWithToString = {
    toString(): string;
};

type Service = {
    proc: child_process.ChildProcess;
    readLine: ReadLine;
};

export default class Runtime {
    private mutex: Mutex = new Mutex();
    private proc?: child_process.ChildProcess;

    public init(): Promise<void> {
        return this.startService();
    }

    public async request<T, R = unknown>(
        request: R,
        timeout = 1000
    ): Promise<T | null | undefined> {
        const release = await this.mutex.acquire();
        const result = await this.requestWithTimeout(request, timeout);
        release();

        return JSON.parse(result.toString()) as T | null;
    }

    private async startService() {
        const { proc, readLine } = await Runtime.runService();
        this.proc = proc;
    }

    private static async runService(): Promise<Service> {
        const args: string[] = [ "--client=vscode" ];
        const command = await Runtime.fetchBinary();

        return Runtime.runProcess(command, args);
    }

    private static async fetchBinary(): Promise<string> {
        // TODO
        return '';
    }

    private static runProcess(
        command: string,
        args?: ReadonlyArray<string>
    ): Service {
        const proc = spawn(command, args);
        const input = proc.stdout;
        const readLine = createInterface({
            input,
            output: proc.stdin,
        } as ReadLineOptions);

        return { proc, readLine };
    }

    private requestWithTimeout<T>(
        request: T,
        timeout: number
    ): Promise<UnkownWithToString> {
        return new Promise<UnkownWithToString>((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Request timeout"));
            }, timeout);

            this.proc?.stdin?.write(
                `${JSON.stringify({
                    request,
                })}\n`,
                "utf8"
            );
        });
    }
}
