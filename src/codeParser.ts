//用於 vscode 的名稱解析
import { CompletionItem, CompletionItemKind, SnippetString, Hover, WorkspaceFolder, Location, Uri, Position, MarkdownString } from 'vscode';
//用於檔案讀取的 FileStream 解析
import * as fs from 'fs';
//用於讀取每一行的解析
import { ReadLinesSync } from './utilities/readLines';
import { isBlank } from './utilities/checkString';

/**
 * 取出變數或方法名稱的 Regex 樣板
 */
const namePat = /\b(?!def|thread|global)\w+/;
/**
 * 取出參數內容的 Regex 樣板
 */
const paramPat = /\((.*?)\)/;

/**
 * 將 RegExpExecArray 轉成對應的 CompletionItems
 * @param matchResult 欲轉換的 Regex 比對結果
 * @param cmpItems 欲儲存的完成項目集合
 */
function parseCmpItem(matchResult: RegExpExecArray | null, cmpItems: CompletionItem[]) {
    /* 如果沒東西，直接離開 */
    if (!matchResult || matchResult.length <= 0) {
        return;
    }
    /* 有東西則輪詢將 Regex 結果轉成 CompletionItem */
    matchResult.forEach(
        value => {
            if (value) {
                /* 用 Regex 取得方法名稱 */
                const nameReg = namePat.exec(value);
                /* 有成功找到，建立完成項目 */
                if (nameReg && !cmpItems.find(cmp => cmp.label === nameReg[0])) {
                    const cmpItem = new CompletionItem(nameReg[0]);
                    cmpItem.commitCharacters = ['\t', ' ', '\n'];
                    if (/global/.test(value)) {         //變數
                        cmpItem.kind = CompletionItemKind.Variable;
                        cmpItem.detail = `(global variable) ${nameReg[0]}`;
                        cmpItem.insertText = nameReg[0];
                    } else if (/thread/.test(value)) {  //執行緒
                        cmpItem.kind = CompletionItemKind.Variable;
                        cmpItem.detail = `(user thread) ${nameReg[0]}`;
                        cmpItem.insertText = `${nameReg[0]}()`;
                    } else {    //方法
                        cmpItem.kind = CompletionItemKind.Function;
                        /* 嘗試尋找參數內容 */
                        const paramReg = paramPat.exec(value);
                        /* 如果有參數，列出來 */
                        if (paramReg && paramReg.length > 1 && !isBlank(paramReg[1])) {
                            /* 將參數給拆出來 */
                            const param = paramReg[1].split(',').map(p => p.trim());
                            /* 組合 */
                            cmpItem.detail = `(user function) ${nameReg[0]}(${param.join(', ')})`;
                            /* 計算 $1~$n */
                            let signIdx = 1;
                            const sign = param.map(p => `\${${signIdx++}:${p}}`);
                            /* 自動填入 */
                            cmpItem.insertText = new SnippetString(`${nameReg[0]}(${sign.join(', ')})$0`);
                        } else {
                            cmpItem.detail = `(user function) ${nameReg[0]}`;
                            cmpItem.insertText = new SnippetString(`${nameReg[0]}()$0`);
                        }
                    }
                    /* 將找到的加入集合 */
                    cmpItems.push(cmpItem);
                }
            }
        }
    );
}

/**
 * 將 RegExpExecArray 轉成對應的 Hover
 * @param matchResult 欲轉換的 Regex 比對結果
 */
function parseHover(matchResult: RegExpExecArray | null): Hover | undefined {
    /* 如果沒東西，直接離開 */
    if (!matchResult || matchResult.length <= 0) {
        return;
    }
    /* 暫存搜尋的結果 */
    const step = matchResult[0];
    /* 用 Regex 取得方法名稱 */
    const nameReg = namePat.exec(step);
    /* 有成功找到，建立完成項目 */
    if (nameReg) {
        let hovItem: Hover | undefined = undefined;
        if (/global/.test(step)) {
            hovItem = new Hover(
                new MarkdownString(`\`global\`  ${nameReg[0]}`)
            );
        } else if (/thread/.test(step)) {
            hovItem = new Hover(
                new MarkdownString(`\`user thread\`  ${nameReg[0]}`)
            );
        } else {
            /* 嘗試尋找參數內容 */
            const paramReg = paramPat.exec(step);
            /* 如果有參數，列出來 */
            if (paramReg && paramReg.length > 1) {
                /* 將參數給拆出來 */
                const param = paramReg[1].split(',').map(p => p.trim());
                /* 組合 */
                hovItem = new Hover(
                    new MarkdownString(`\`user function\`  ${nameReg[0]}(${param.join(', ')})`)
                );
            } else {
                hovItem = new Hover(
                    new MarkdownString(`\`user function\`  ${nameReg[0]}()`)
                );
            }
        }
        return hovItem;
    }
}

/**
 * 搜尋文字內容的所有方法與全域變數
 * @param text 欲搜尋的文字
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getCompletionItemsFromText(text: string, keyword: string, cmpItems: CompletionItem[]) {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    /* 迴圈尋找符合的方法 */
    let match: RegExpExecArray | null;
    while (match = mthdPat.exec(text)) {
        /* 解析並加入集合 */
        parseCmpItem(match, cmpItems);
    }
}

/**
 * 搜尋檔案內容的所有方法與全域變數
 * @param fileName 欲搜尋的檔案路徑
 * @param keyword 當前使用者輸入的關鍵字
 * @param cmpItems 欲儲存的完成項目集合
 */
export function getCompletionItemsFromFile(fileName: fs.PathLike, keyword: string, cmpItems: CompletionItem[]) {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    /* 建立行讀取器 */
    const lineReader = new ReadLinesSync(fileName);
    /* 輪詢每一行 */
    for (const pkg of lineReader) {
        /* 確保有讀到東西 */
        if (pkg.line) {
            /* 利用 Regex 尋找方法或變數名稱 */
            const match = mthdPat.exec(pkg.line.toString());
            /* 解析並加入集合 */
            parseCmpItem(match, cmpItems);
        }
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
            /* 取得檔案資訊 */
            const stat = fs.statSync(file);
            /* 取得檔案大小 */
            const fileSize = stat.size / 1048576.0;   //bytes → mb, 1024*1024=1048576
            /* 如果檔案小小的，直接用記憶體讀 */
            if (fileSize < 5.0) {
                /* 讀取所有字元 */
                const text = fs.readFileSync(file, 'utf-8');
                /* 解析 */
                getCompletionItemsFromText(text, keyword, cmpItems);
            } else {
                /* 太大用 ReadLineSync */
                getCompletionItemsFromFile(file, keyword, cmpItems);
            }
        }
    );
}

/**
 * 搜尋文字內容的指定關鍵字並轉換成滑鼠提示
 * @param text 欲搜尋的文字
 * @param keyword 當前使用者停留的關鍵字
 */
export function getHoverFromText(text: string, keyword: string): Hover | undefined {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    /* 迴圈尋找符合的方法 */
    const match = mthdPat.exec(text);
    /* 回傳 */
    return parseHover(match);
}

/**
 * 搜尋檔案內容的指定關鍵字並轉換成滑鼠提示
 * @param fileName 欲搜尋的檔案路徑
 * @param keyword 當前使用者停留的關鍵字
 */
export function getHoverFromFile(fileName: string, keyword: string): Hover | undefined {
    /* 建立 Regex Pattern */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "gm");
    /* 建立讀取器 */
    const lineReader = new ReadLinesSync(fileName);
    /* 輪詢每一行 */
    let hov: Hover | undefined;
    for (const pkg of lineReader) {
        /* 確保有讀到東西 */
        if (pkg.line) {
            /* 嘗試找出方法或變數 */
            const match = mthdPat.exec(pkg.line.toString());
            /* 解析是否有符合的物件 */
            hov = parseHover(match);
            /* 成功找到則離開迴圈 */
            if (hov) {
                break;
            }
        }
    }
    /* 回傳 */
    return hov;
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
    let hov: Hover | undefined;
    for (const file of files) {
        /* 取得檔案資訊 */
        const stat = fs.statSync(file);
        /* 取得檔案大小 */
        const fileSize = stat.size / 1048576.0;   //bytes → mb, 1024*1024=1048576
        /* 如果檔案小小的，直接用記憶體讀 */
        if (fileSize < 5.0) {
            /* 讀取所有字元 */
            const text = fs.readFileSync(file, 'utf-8');
            /* 嘗試搜尋 */
            hov = getHoverFromText(text, keyword);
        } else {
            /* 太大用 ReadLineSync */
            hov = getHoverFromFile(file, keyword);
        }
        /* 如果有東西則離開迴圈 */
        if (hov) {
            break;
        }
    }
    /* 回傳 */
    return hov;
}

/**
 * 搜尋檔案內容的指定關鍵字並轉換成定義位置
 * @param fileName 欲解析的檔案路徑
 * @param keyword 欲搜尋的關鍵字
 */
export function getLocationFromFile(fileName: fs.PathLike, keyword: string): Location[] {
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
                        Uri.file(fileName.toString()),
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