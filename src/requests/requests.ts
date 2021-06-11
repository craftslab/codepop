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

import * as vscode from 'vscode';
import { CompleteOrigin, CompleteState } from '../proto/proto';
import Runtime from '../runtime/runtime';

export type Result = {
    newPrefix: string;
    oldSuffix: string;
    newSuffix: string;

    kind?: vscode.CompletionItemKind;
    origin?: CompleteOrigin;
    detail?: string;
};

export type CompleteParams = {
    fileName: string;
    before: string;
    after: string;
    regionIncludesBeginning: boolean;
    regionIncludesEnd: boolean;
    maxNumResults: number;
};

export type CompleteResult = {
    oldPrefix: string;
    results: Result[];
    userMessage: string[];
};

export default class Requests {
    private runtime = new Runtime();

    public init(context: vscode.ExtensionContext): Promise<void> {
        return this.runtime.init(context);
    }

    public deinit(): Promise<unknown> {
        if (this.runtime) {
            return this.runtime.request({ deinit: {} });
        }
        return Promise.resolve(null);
    }

    public result(
        data: CompleteParams
    ): Promise<CompleteResult | undefined | null> {
        return this.runtime.request<CompleteResult | undefined | null>({ complete: data });
    }

    public state(
        content: Record<string | number | symbol, unknown> = {}
    ): Promise<CompleteState | null | undefined> {
        return this.runtime.request<CompleteState>({ state: content });
    }
}
