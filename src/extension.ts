'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createFunctions } from './scriptmethod';
import { URScriptCompletionItemProvider } from './features/completionItemProvider';
import { URScriptHoverProvider } from './features/hoverProvider';
import { URScriptSignatureHelpProvider, URScriptSignatureHelpProviderMetadata } from './features/signatureHelpProvider';
import { URScriptFormattingProvider } from './features/formattingEditProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    /* 更改 VSCode 環境 */
    if (vscode.window.activeTextEditor) {
        /* 啟用空白縮排、2 個空格 */
        vscode.window.activeTextEditor.options = {
            cursorStyle: vscode.window.activeTextEditor.options.cursorStyle,
            insertSpaces: true,
            tabSize: 2
        };
        /* 將結尾符號改成 LF */
        vscode.window.activeTextEditor.edit(
            builder => builder.setEndOfLine(vscode.EndOfLine.LF)
        );
    }

    /* 載入 functions.json */
    const funcs = createFunctions();
    console.log("got %d script methods", funcs.length);

    /* 自動完成項目 */
    const cmpPvd = vscode.languages.registerCompletionItemProvider(
        'urscript',
        new URScriptCompletionItemProvider(funcs)
    );

    /* 滑鼠停留提示 */
    const hovPvd = vscode.languages.registerHoverProvider(
        'urscript',
        new URScriptHoverProvider(funcs)
    );

    /* 簽章提示 */
    const sigPvd = vscode.languages.registerSignatureHelpProvider(
        'urscript',
        new URScriptSignatureHelpProvider(funcs),
        new URScriptSignatureHelpProviderMetadata()
    );

    /* 文件範圍排版 */
    const fmtPvd = vscode.languages.registerDocumentRangeFormattingEditProvider(
        'urscript',
        new URScriptFormattingProvider()
    );

    /* 輸入時的自動排版 */
    const typPvd = vscode.languages.registerOnTypeFormattingEditProvider(
        'urscript',
        new URScriptFormattingProvider(),
        '\n', ':'
    );

    /* 加入上下文的訂閱器中 */
    context.subscriptions.push(cmpPvd, hovPvd, sigPvd, fmtPvd, typPvd);
}

// this method is called when your extension is deactivated
export function deactivate() {
}