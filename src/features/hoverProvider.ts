//用於 vscode 的名稱解析
import {
    CancellationToken,
    Hover,
    HoverProvider,
    Position,
    TextDocument,
    workspace,
    Range
} from 'vscode';
//用於載入外部的方法集合
import { ScriptMethod } from '../scriptmethod';
//用於解析程式碼以提供相關物件的解析
import { getHoverFromWorkspace, getHoverFromDocument } from '../codeParser';
//檢查字串是否為空字串
import { isBlank } from '../utilities/checkString';

/**
 * 儲存 ScriptMethod 對應的 Hover 項目
 */
class ScriptHover {

    /** 方法名稱 */
    Name: string;
    /** 方法對應的提示項目 */
    Item: Hover;

    /**
     * 建構方法對應項目
     * @param mthd 欲處理的 Script 方法
     */
    constructor(mthd: ScriptMethod) {
        this.Name = mthd.Name;
        this.Item = new Hover(
            [
                {
                    language: 'urscript',
                    value: mthd.Label
                },
                mthd.Documentation
            ]
        );
    }
}

/**
 * 適用於 URScript 的滑鼠停留提示供應器
 */
export class URScriptHoverProvider implements HoverProvider {

    /** 儲存已解析完的官方 API 方法提示項目 */
    private scriptHovItems: ScriptHover[];

    /**
     * 建構滑鼠停留供應器
     * @param funcs 已載入的 URScript 方法集合
     */
    public constructor(funcs: ScriptMethod[]) {
        this.scriptHovItems = funcs.map(mthd => new ScriptHover(mthd));
    }

    /**
     * 取得當前滑鼠停留的字詞提示
     * @param document vscode 當前的文字編輯器
     * @param position 當前滑鼠的座標
     * @param token 指出是否取消動作的物件
     */
    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        try {
            /* 取得當前滑鼠所停留位置是否有字詞(前後為符號或空白則認定字詞)，如果有則取得其字詞範圍 */
            let wordRange = document.getWordRangeAtPosition(position);
            /* 如果滑鼠指到奇怪的地方，就不理他囉 */
            if (!wordRange) {
                return undefined;
            }
            /* 取得停留位置上的字詞 */
            let word = document.getText(wordRange);
            /* 如果有東西，則進行搜尋比對 */
            if (!isBlank(word)) {
                /* 利用 find 尋找是否有符合的方法名稱 */
                let matchHover = this.scriptHovItems.find(hovItem => hovItem.Name === word);
                /* 如果有找到官方方法，回傳之 */
                if (matchHover) {
                    /* 由於 Hover 有可能會重複指到一個定義，所以將 Range 清空讓他自動重抓 */
                    matchHover.Item.range = undefined;
                    /* 回傳 */
                    return matchHover.Item;
                } else {
                    /* 先從當前文件找起 */
                    let hov = getHoverFromDocument(document, word);
                    /* 如果沒有，則往 Workspace 開找 */
                    if (!hov && workspace.workspaceFolders) {
                        /* 輪詢各個資料夾 */
                        for (const fold of workspace.workspaceFolders) {
                            /* 嘗試找出 Hover */
                            hov = getHoverFromWorkspace(fold, word, document.fileName);
                            /* 如果有則離開並回傳 */
                            if (hov) {
                                break;
                            }
                        }
                    }
                    /* 回傳 */
                    return hov;
                }
            }
        } catch (error) {
            return undefined;
        }
    }
}