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

export const brandName = 'codepop';
export const charLimit = 100_000;
export const completeLabel = brandName;
export const defaultDetail = brandName;
export const maxNumResults = 5;

export const triggerCharacters = [
    " ",
    ".",
    "(",
    ")",
    "{",
    "}",
    "[",
    "]",
    ",",
    ":",
    "'",
    '"',
    "=",
    "<",
    ">",
    "/",
    "\\",
    "+",
    "-",
    "|",
    "&",
    "*",
    "%",
    "=",
    "$",
    "#",
    "@",
    "!",
];

export enum CompleteOrigin {
    cloud = 'cloud',
    local = 'local',
    lsp = 'lsp',
    unknown = 'unknown',
}

export type CompleteState = {
    version: string;
    language: string;
    cloudEnabled: boolean;
    localEnabled: boolean;
    lspEnabled: boolean;
};
