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
import * as vscode from 'vscode';
import { createInterface, ReadLine, ReadLineOptions } from 'readline';
import { Mutex } from 'await-semaphore';
import { spawn } from 'child_process';
import Binary from '../binary/binary';

type Service = {
    proc: child_process.ChildProcess;
    readLine: ReadLine;
};

type UnkownWithToString = {
    toString(): string;
};

export default class Runtime {
    private binary = new Binary();
    private mutex = new Mutex();
    private proc: child_process.ChildProcess | undefined;

    public init(context: vscode.ExtensionContext): Promise<void> {
        this.binary.init(context);
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
        const { proc, readLine } = await this.runService();
        this.proc = proc;
    }

    private async runService(): Promise<Service> {
        const args: string[] = ['--client=vscode'];
        const cmd = await this.binary.fetch();

        return Runtime.runProcess(cmd, args);
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
                reject(new Error('Request timeout'));
            }, timeout);

            this.proc?.stdin?.write(
                `${JSON.stringify({
                    request,
                })}\n`,
                'utf8'
            );
        });
    }
}
