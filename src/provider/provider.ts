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

import * as vscode from "vscode";

const isIncomplete = true;

export default async function provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
): Promise<vscode.CompletionList> {
    return new vscode.CompletionList(
        await completionItem(document, position, token, context),
        isIncomplete
    );
}

async function completionItem(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
): Promise<vscode.CompletionItem[]> {
    let message = 'fileName:' + document.fileName;
    message += 'lineCount:' + document.lineCount;
    message += 'languageId:' + document.languageId;
    message += 'getText:' + document.getText();
    message += 'uri:' + document.uri;
    message += 'version:' + document.version;
    message += 'character:' + position.character;
    message += 'line:' + position.line;
    message += 'CancellationRequested:' + token.isCancellationRequested;
    message += 'triggerCharacter:' + context.triggerCharacter;
    message += 'triggerKind:' + context.triggerKind;
    vscode.window.showInformationMessage(message);

    // TODO
    return [];
}
