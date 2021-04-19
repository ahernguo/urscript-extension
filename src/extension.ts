'use strict';
// VSCode extensibility API
import * as vscode from 'vscode';
// tools for Script
import { createFunctions } from './scriptmethod';
// for CompletionItem
import { URScriptCompletionItemProvider } from './features/completionItemProvider';
// for Hover
import { URScriptHoverProvider } from './features/hoverProvider';
// for SignatureHelp
import { URScriptSignatureHelpProvider, URScriptSignatureHelpProviderMetadata } from './features/signatureHelpProvider';
// for Formatting
import { URScriptFormattingProvider } from './features/formattingEditProvider';
// for Definition
import { URScriptDefinitionProvider } from './features/definitionProvider';
// for DocumentSymbol
import { URScriptDocumentSymbolProvider } from './features/documentSymbolProvider';

/**
 * The entry point of this extension when enabled. E.g. swithcing to 'URScript' language, open '.script' file, etc.
 * Setting in 'activationEvents' in 'package.json'
 * @param context context from vscode
 */
export function activate(context: vscode.ExtensionContext) {

    /* forcing to set environment. 
       This is coding standard from company. You may change manually. */
    if (vscode.window.activeTextEditor) {
        /* indent with 2 spaces (not tab) */
        vscode.window.activeTextEditor.options = {
            cursorStyle: vscode.window.activeTextEditor.options.cursorStyle,
            insertSpaces: true,
            tabSize: 2
        };
        /* end of line char sets to '\n' */
        vscode.window.activeTextEditor.edit(
            builder => builder.setEndOfLine(vscode.EndOfLine.LF)
        );
    }

    /* loading functions.json */
    const funcs = createFunctions();
    console.log("got %d script methods", funcs.length);

    /* create CompletionItem.
       showing tooltip for API, custom function or variable when coding.
       triggered with '#' and '@' sign when typing UrDoc.
       auto fill with 'tab' 'space' 'enter'.  */
    const cmpPvd = vscode.languages.registerCompletionItemProvider(
        'urscript',
        new URScriptCompletionItemProvider(funcs),
        '#', '@'
    );

    /* create Hover.
       showing tooltip when mouse stay in a function or variable. */
    const hovPvd = vscode.languages.registerHoverProvider(
        'urscript',
        new URScriptHoverProvider(funcs)
    );

    /* create SignatureHelp.
       showing function parameter info/detail when typing function parameters
       triggered with '(' and ',' */
    const sigPvd = vscode.languages.registerSignatureHelpProvider(
        'urscript',
        new URScriptSignatureHelpProvider(funcs),
        new URScriptSignatureHelpProviderMetadata()
    );

    /* create DocumentRangeFormatting
       format current editor with indent (follow vscode setting), trim spaces */
    const fmtPvd = vscode.languages.registerDocumentRangeFormattingEditProvider(
        'urscript',
        new URScriptFormattingProvider()
    );

    /* create OnTypeFormatting
       format current line when 'enter' or ':' pressed. do indent, trim spaces */
    const typPvd = vscode.languages.registerOnTypeFormattingEditProvider(
        'urscript',
        new URScriptFormattingProvider(),
        '\n', ':'
    );

    /* create Definition
       search all files in workspace with keyword which pointer stay  */
    const defPvd = vscode.languages.registerDefinitionProvider(
        'urscript',
        new URScriptDefinitionProvider()
    );

    /* create DocumentSymbol
       provide for 'Ctrl + Shift + O' / 'Ctrl + P → @' and outline window */
    const symPvd = vscode.languages.registerDocumentSymbolProvider(
        'urscript',
        new URScriptDocumentSymbolProvider()
    );

    /* register providers from above */
    context.subscriptions.push(cmpPvd, hovPvd, sigPvd, fmtPvd, typPvd, defPvd, symPvd);
}

/**
 * terminal callback when close or disabled
 */
export function deactivate() {
}