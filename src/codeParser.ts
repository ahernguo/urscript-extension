//用於 vscode 的名稱解析
import { CompletionItem, CompletionItemKind, SnippetString, Hover, WorkspaceFolder, Location, Uri, Position } from 'vscode';
//用於檔案讀取的 FileStream 解析
import * as fs from 'fs';
import { ReadLinesSync } from './utilities/readLines';

/**
 * 搜尋文字內容的所有方法與全域變數
 * @param text 欲搜尋的文字
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getCompletionItemsFromText(text: string, keyword: string, cmpItems: CompletionItem[]) {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    const namePat = /\b(?!def|thread|global)\w+/gm;
    /* 迴圈尋找符合的方法 */
    let match: RegExpExecArray | null;
    while (match = mthdPat.exec(text)) {
        /* 若有找到方法，輪詢結果 */
        match.forEach(
            value => {
                if (value) {
                    /* 用 Regex 取得方法名稱 */
                    const nameReg = namePat.exec(value);
                    /* 有成功找到，建立完成項目 */
                    if (nameReg && !cmpItems.find(cmp => cmp.label === nameReg[0])) {
                        const cmpItem = new CompletionItem(nameReg[0]);
                        cmpItem.commitCharacters = ['\t', ' '];
                        if (/global/.test(value)) {
                            cmpItem.kind = CompletionItemKind.Variable;
                            cmpItem.detail = `(global variable) ${nameReg[0]}`;
                            cmpItem.insertText = nameReg[0];
                        } else if (/thread/.test(value)) {
                            cmpItem.kind = CompletionItemKind.Variable;
                            cmpItem.detail = `(user thread) ${nameReg[0]}`;
                            cmpItem.insertText = `${nameReg[0]}()`;
                        } else {
                            cmpItem.kind = CompletionItemKind.Function;
                            cmpItem.detail = `(user function) ${nameReg[0]}`;
                            cmpItem.insertText = new SnippetString(`${nameReg[0]}($0)`);
                        }

                        cmpItems.push(cmpItem);
                    }
                }
            }
        );
    }
}

/**
 * 搜尋 Workspace 內的所有檔案方法與全域變數
 * @param workspace 欲搜尋的 Workspace 路徑
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getCompletionItemsFromWorkspace(workspace: WorkspaceFolder, keyword: string, cmpItems: CompletionItem[]) {
    /* 取得資料夾內的所有檔案 */
    const files = fs.readdirSync(workspace.uri.fsPath)
        .filter(file => file.endsWith('.script'))
        .map(file => `${workspace.uri.fsPath}\\${file}`);
    /* 輪詢所有檔案 */
    files.forEach(
        file => {
            /* 讀取所有字元 */
            const text = fs.readFileSync(file, 'utf-8');
            /* 解析 */
            getCompletionItemsFromText(text, keyword, cmpItems);
        }
    );
}

/**
 * 搜尋文字內容的指定關鍵字並轉換成滑鼠提示
 * @param text 欲搜尋的文字
 * @param keyword 當前使用者輸入的關鍵字
 */
export function getHoverFromText(text: string, keyword: string): Hover | undefined {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    const namePat = /\b(?!def|thread|global)\w+/gm;
    /* 迴圈尋找符合的方法 */
    const match = mthdPat.exec(text);
    if (match) {
        /* 用 Regex 取得方法名稱 */
        const nameReg = namePat.exec(match[0]);
        /* 有成功找到，建立完成項目 */
        if (nameReg) {
            let hovItem: Hover | undefined = undefined;
            if (/global/.test(match[0])) {
                hovItem = new Hover(`(global variable) ${nameReg[0]}`);
            } else if (/thread/.test(match[0])) {
                hovItem = new Hover(`(user thread) ${nameReg[0]}`);
            } else {
                hovItem = new Hover(`(user function) ${nameReg[0]}`);
            }
            return hovItem;
        }
    }
}

/**
 * 搜尋 Workspace 內的所有檔案方法與全域變數
 * @param workspace 欲搜尋的 Workspace 路徑
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getHoverFromWorkspace(workspace: WorkspaceFolder, keyword: string, explored: string): Hover | undefined {
    /* 取得資料夾內的所有檔案 */
    const files = fs.readdirSync(workspace.uri.fsPath)
        .filter(file => file.endsWith('.script') && (file !== explored.split(/.*[\/|\\]/)[1]))
        .map(file => `${workspace.uri.fsPath}\\${file}`);
    /* 輪詢所有檔案 */
    for (const file of files) {
        /* 讀取所有字元 */
        const text = fs.readFileSync(file, 'utf-8');
        /* 嘗試搜尋 */
        const hov = getHoverFromText(text, keyword);
        /* 如果有東西則回傳 */
        if (hov) {
            return hov;
        }
    }
}

/**
 * 搜尋檔案內容的指定關鍵字並轉換成定義位置
 * @param fileName 欲解析的檔案路徑
 * @param keyword 欲搜尋的關鍵字
 */
export function getLocationFromFile(fileName: string, keyword: string): Location[] {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    const namePat = /\b(?!def|thread|global)\w+/gm;    
    /* 宣告回傳變數 */
    let locColl: Location[] = [];
    /* 建立行讀取器 */
    const lineReader = new ReadLinesSync(fileName);
    /* 輪詢每一行，直至找到關鍵字 */
    for (const ret of lineReader) {
        /* 確保有讀到資料 */
        if (ret.line) {
            /* 迴圈尋找符合的方法 */
            const match = mthdPat.exec(ret.line.toString());
            if (match) {
                /* 用 Regex 取得方法名稱 */
                const nameReg = namePat.exec(match[0]);
                /* 有成功找到，建立完成項目 */
                if (nameReg) {
                    const loc = new Location(
                        Uri.file(fileName),
                        new Position(
                            ret.lineNo,
                            nameReg.index
                        )
                    );
                    locColl.push(loc);
                }
            }
        }
    }
    return locColl;
}

/**
 * 搜尋 Workspace 內的所有檔案，藉以找出定義位置
 * @param workspace 欲搜尋的 Workspace 路徑
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getLocationFromWorkspace(workspace: WorkspaceFolder, keyword: string, explored: string): Location[] {
    /* 取得資料夾內的所有檔案 */
    const files = fs.readdirSync(workspace.uri.fsPath)
        .filter(file => file.endsWith('.script') && (file !== explored.split(/.*[\/|\\]/)[1]))
        .map(file => `${workspace.uri.fsPath}\\${file}`);
    /* 初始化變數 */
    let locColl: Location[] = [];
    /* 輪詢所有檔案 */
    for (const file of files) {
        /* 讀取 Location */
        const loc = getLocationFromFile(file, keyword);
        if (loc) {
            loc.forEach(l => locColl.push(l));
        }
    }
    /* 回傳 */
    return locColl;
}