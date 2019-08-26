//用於 vscode 的名稱解析
import { CompletionItemProvider, CompletionItem, CompletionItemKind, CompletionContext, CancellationToken, TextDocument, Position, CompletionList, SnippetString } from 'vscode';
//用於載入外部的方法集合
import { ScriptMethod } from '../scriptmethod';

/**
 * 適用於 URScript 的自動完成項目供應器
 */
export default class URScriptCompletionItemProvider implements CompletionItemProvider {

    /** 儲存外部已經載入的 ScriptMethod 集合 */
    private mMthds: ScriptMethod[];

    /**
     * 建構自動完成項目供應器
     * @param funcs 已載入的 URScript 方法集合
     */
    public constructor(funcs: ScriptMethod[]) {
        this.mMthds = funcs;
    }

    /**
     * 取得自動完成項目集合
     * @param document vscode 當前的文字編輯器
     * @param position 當前文字插入點的座標
     * @param token 指出是否取消動作的物件
     * @param context 欲處理的上下文
     */
    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList> {
        /* 輪詢每一個方法，回傳對應的 CompletionItem */
        const itemColl = this.mMthds.map(
            mthd => {
                /* 初始化要回傳的 CompletionItem */
                let cmpItem = new CompletionItem(mthd.Name, CompletionItemKind.Method);
                /* 加入方法名稱與簽章 */
                cmpItem.detail = mthd.Label;
                /* 加入要自動填寫的文字，因要讓使用者輸入 '(' 時跳出註解，故這邊輸入名稱就好 */
                cmpItem.insertText = new SnippetString(mthd.Name);
                /* 加入自動完成的符號 */
                cmpItem.commitCharacters = [ '(', ')', ':' ];
                /* 加入文件註解 */
                cmpItem.documentation = mthd.Documentation;
                /* 回傳 */
                return cmpItem;
            }
        );
        /* 回傳集合 */
        return new CompletionList(itemColl, false);
    }
    
}