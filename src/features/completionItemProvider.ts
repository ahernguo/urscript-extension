//用於 vscode 的名稱解析
import { CompletionItemProvider, CompletionItem, CompletionItemKind, CompletionContext, CancellationToken, TextDocument, Position, CompletionList, SnippetString, Range, workspace } from 'vscode';
//用於載入外部的方法集合
import { ScriptMethod } from '../scriptmethod';
//用於解析程式碼以提供相關物件的解析
import { getCompletionItemsFromText, getCompletionItemsFromWorkspace } from '../codeParser';
//檢查字串是否為空字串
import { isBlank } from '../utilities/checkString';

/**
 * 適用於 URScript 的自動完成項目供應器
 */
export class URScriptCompletionItemProvider implements CompletionItemProvider {

    /** 儲存已解析完的官方 API 方法完成項目 */
    private scriptCmpItems: CompletionItem[];

    /**
     * 建構自動完成項目供應器
     * @param funcs 已載入的 URScript 方法集合
     */
    public constructor(funcs: ScriptMethod[]) {
        this.scriptCmpItems = funcs.map(
            mthd => {
                /* 初始化要回傳的 CompletionItem */
                let cmpItem = new CompletionItem(mthd.Name, CompletionItemKind.Method);
                /* 加入方法名稱與簽章 */
                cmpItem.detail = mthd.Label;
                /* 加入要自動填寫的文字，因要讓使用者輸入 '(' 時跳出註解，故這邊輸入名稱就好 */
                cmpItem.insertText = new SnippetString(mthd.Name);
                /* 加入自動完成的符號 */
                cmpItem.commitCharacters = [ '(', ')', ':', '\t', '\n', ' ' ];
                /* 加入文件註解 */
                cmpItem.documentation = mthd.Documentation;
                /* 回傳 */
                return cmpItem;
            }
        );
    }

    /**
     * 取得自動完成項目集合
     * @param document vscode 當前的文字編輯器
     * @param position 當前文字插入點的座標
     * @param token 指出是否取消動作的物件
     * @param context 欲處理的上下文
     */
    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList | undefined> {
        try {
            /* 取得當前輸入的文字 */
            let word = '';
            const wordRange = document.getWordRangeAtPosition(position);
            if (wordRange) {
                word = document.getText(
                    new Range(wordRange.start, position)
                );
            }
            /* 如果無法取得當前的文字，直接離開！ */
            if (isBlank(word)) {
                return undefined;
            }
            /* 取得符合當前輸入文字的方法 */
            const matchItems = this.scriptCmpItems.filter(
                mthd => mthd.label.startsWith(word)
            );
            /* 將當前的所有方法給解析出來 */
            if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
                workspace.workspaceFolders.forEach(workspace => {
                    getCompletionItemsFromWorkspace(workspace, word, matchItems);
                });
            } else {
                getCompletionItemsFromText(document.getText(), word, matchItems);
            }
            /* 回傳集合 */
            return new CompletionList(matchItems, !(word.length > 1));
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }
    
}