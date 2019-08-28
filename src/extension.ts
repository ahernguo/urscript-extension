'use strict';
// VSCode extensibility API
import * as vscode from 'vscode';
// Script 方法載入
import { createFunctions } from './scriptmethod';
// 自動完成項目
import { URScriptCompletionItemProvider } from './features/completionItemProvider';
// 滑鼠停留提示
import { URScriptHoverProvider } from './features/hoverProvider';
// 簽章提示
import { URScriptSignatureHelpProvider, URScriptSignatureHelpProviderMetadata } from './features/signatureHelpProvider';
// 排版功能
import { URScriptFormattingProvider } from './features/formattingEditProvider';

/**
 * 此套件的啟用方法。於切換至 URScript 語言時回呼此至此，由 package.json 內的 `activationEvents` 進行設定
 * @param context 欲處理的上下文
 */
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

/**
 * 此套件的關閉方法。會於離開或手動禁用時回呼至此
 */
export function deactivate() {
}