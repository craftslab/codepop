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
import { brandName, charLimit, completeLabel, defaultDetail, maxNumResults } from "../proto/proto";
import Requests, { CompleteResult, Result } from '../requests/requests';

const isIncomplete = true;
const requests = new Requests();

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
    // For debugging
    // showDetails(document, position, token, context);

    const offset = document.offsetAt(position);
    const beforeStartOffset = Math.max(0, offset - charLimit);
    const afterEndOffset = offset + charLimit;
    const beforeStart = document.positionAt(beforeStartOffset);
    const afterEnd = document.positionAt(afterEndOffset);

    const response: CompleteResult | null | undefined = await requests.result({
        fileName: document.fileName,
        before: document.getText(new vscode.Range(beforeStart, position)),
        after: document.getText(new vscode.Range(position, afterEnd)),
        regionIncludesBeginning: beforeStartOffset === 0,
        regionIncludesEnd: document.offsetAt(afterEnd) !== afterEndOffset,
        maxNumResults: maxNumResults
    });

    if (!response || response?.results.length === 0) {
        return [];
    }

    return response.results.slice(0, response.results.length).map((entry, index) =>
        makeCompletionItem({
            document,
            index,
            position,
            detailMessage: extractDetailMessage(response),
            oldPrefix: response.oldPrefix,
            entry,
            results: response.results,
        })
    );
}

function showDetails(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
): void {
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
}

function makeCompletionItem(args: {
    document: vscode.TextDocument;
    index: number;
    position: vscode.Position;
    detailMessage: string;
    oldPrefix: string;
    entry: Result;
    results: Result[];
}): vscode.CompletionItem {
    const item = new vscode.CompletionItem(completeLabel + args.entry.newPrefix);

    item.detail = brandName;
    item.filterText = args.entry.newPrefix;
    item.insertText = new vscode.SnippetString(escapeTabStopSign(args.entry.newPrefix));
    item.kind = args.entry.kind;
    item.preselect = args.index === 0;
    item.range = new vscode.Range(
        args.position.translate(0, -args.oldPrefix.length),
        args.position.translate(0, args.entry.oldSuffix.length)
    );
    item.sortText = String.fromCharCode(0) + String.fromCharCode(args.index);

    if (args.entry.newSuffix) {
        item.insertText
            .appendTabstop(0)
            .appendText(escapeTabStopSign(args.entry.newSuffix));
    }

    return item;
}

function extractDetailMessage(response: CompleteResult) {
    return (response.userMessage || []).join("\n") || defaultDetail;
}

function escapeTabStopSign(value: string) {
    return value.replace(new RegExp("\\$", "g"), "\\$");
}
