//用於 vscode 的名稱解析
import { CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
//用於檔案讀取的 FileStream 解析
import * as fs from 'fs';

/**
 * 搜尋檔案內的所有方法與全域變數
 * @param fileName 欲搜尋的檔案
 * @param cmpItems 欲儲存的完成項目集合
 */
export function searchFileFunctions(fileName: string, cmpItems: CompletionItem[]) {
    /* 宣告變數 */
    let text = '';
    /* 讀取檔案 */
    fs.readFile(
        fileName,
        (err, data) => {
            /* 如果有錯誤，直接跳走 */
            if (err) {
                throw err;
            }
            /* 讀取所有字元 */
            text = data.toString();
        }
    );
    /* 如果有東西 */
    if (text !== '') {
        searchFunctions(text, cmpItems);
    }
}

/**
 * 搜尋文字內容的所有方法與全域變數
 * @param text 欲搜尋的文字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function searchFunctions(text: string, cmpItems: CompletionItem[]) {
    /* 建立 Regex Pattern */
    const mthdPat = /\b(def|thread).*\(.*\):/igm;
    const namePat = /\b(?!def|thread|global)\w+/gm;
    const globPat = /\b(global)\b.*/igm;
    /* 迴圈尋找符合的方法 */
    let match: RegExpExecArray | null;
    while (match = mthdPat.exec(text)) {
        /* 若有找到方法，輪詢結果 */
        match.forEach(
            value => {
                /* 用 Regex 取得方法名稱 */
                const nameReg = namePat.exec(value);
                /* 有成功找到，建立完成項目 */
                if (nameReg) {
                    const cmpItem = new CompletionItem(
                        nameReg[0],
                        CompletionItemKind.Function
                    );
                    cmpItem.commitCharacters = ['\t', ' '];
                    cmpItem.detail = `(local) ${nameReg[0]}`;
                    cmpItem.insertText = new SnippetString(`${nameReg[0]}($0)`);
                    cmpItems.push(cmpItem);
                }
            }
        );
    }
    /* 迴圈尋找全域變數 */
    while (match = globPat.exec(text)) {
        /* 若有找到方法，輪詢結果 */
        match.forEach(
            value => {
                /* 用 Regex 取得方法名稱 */
                const nameReg = namePat.exec(value);
                /* 有成功找到，建立完成項目 */
                if (nameReg) {
                    const cmpItem = new CompletionItem(
                        nameReg[0],
                        CompletionItemKind.Variable
                    );
                    cmpItem.commitCharacters = ['\t', ' '];
                    cmpItem.detail = `(global) ${nameReg[0]}`;
                    cmpItem.insertText = new SnippetString(nameReg[0]);
                    cmpItems.push(cmpItem);
                }
            }
        );
    }
}