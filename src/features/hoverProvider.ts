//用於 vscode 的名稱解析
import { HoverProvider, Hover, TextDocument, CancellationToken, Position } from 'vscode';
//用於載入外部的方法集合
import { ScriptMethod } from '../scriptmethod';
//用於判斷物件是否為空
import { isNullOrUndefined } from 'util';

/**
 * 適用於 URScript 的滑鼠停留提示供應器
 */
export default class URScriptHoverProvider implements HoverProvider {

    /** 儲存外部已經載入的 ScriptMethod 集合 */
    private mMthds: ScriptMethod[];

    /**
     * 建構滑鼠停留供應器
     * @param funcs 已載入的 URScript 方法集合
     */
    public constructor(funcs: ScriptMethod[]) {
        this.mMthds = funcs;
    }

    /**
     * 取得當前滑鼠停留的字詞提示
     * @param document vscode 當前的文字編輯器
     * @param position 當前滑鼠的座標
     * @param token 指出是否取消動作的物件
     */
    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        /* 取得當前滑鼠所停留位置是否有字詞(前後為符號或空白則認定字詞)，如果有則取得其字詞範圍 */
        let wordRange = document.getWordRangeAtPosition(position);
        /* 取得停留位置上的字詞 */
        let word = document.getText(wordRange);
        /* 如果有東西，則進行搜尋比對 */
        if (word !== "") {
            //利用 find 尋找是否有符合的方法名稱
            let matched = this.mMthds.find(mthd => mthd.Name === word);
            //如果有找到符合的方法，則建立 Hover 並回傳 Documentation
            if (!isNullOrUndefined(matched)) {
                return new Hover(matched.Documentation);
            }
        }
        /* 如果沒有字詞或找不到符合的方法，回傳空值 */
        return undefined;
    }
    
}