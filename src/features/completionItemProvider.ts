//用於 vscode 的名稱解析
import {
    CancellationToken,
    CompletionContext,
    CompletionItem,
    CompletionItemKind,
    CompletionItemProvider,
    CompletionList,
    MarkdownString,
    Position,
    Range,
    SnippetString,
    TextDocument,
    workspace
} from 'vscode';
//用於載入外部的方法集合
import { ScriptMethod } from '../scriptmethod';
//用於解析程式碼以提供相關物件的解析
import { getCompletionItemsFromDocument, getCompletionItemsFromWorkspace } from '../codeParser';
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
                cmpItem.commitCharacters = ['(', ')', ':', '\t', '\n', ' '];
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
            /* 如果是字詞，取得完整的字詞 */
            if (wordRange) {
                word = document.getText(
                    new Range(wordRange.start, position)
                );
            } else {
                /* 非字詞則檢查是否是特殊符號 */
                const line = document.lineAt(position.line);
                word = line.text.trim();
            }
            /* 如果無法取得當前的文字，直接離開！ */
            if (isBlank(word)) {
                return undefined;
            }
            /* 如果當前是輸入註解符號 '#' 則依照下一行決定插入方法或變數註解。確保下一行有東西可以抓，否則就只是一般註解 */
            if (word.startsWith('#') && (document.lineCount > (position.line + 1))) {
                /* 取得下一行的文字 */
                const nextLine = document.lineAt(position.line + 1);
                if (nextLine && !nextLine.isEmptyOrWhitespace) {
                    /* 建立完成項目 */
                    const cmpItem = new CompletionItem('###', CompletionItemKind.Snippet);
                    cmpItem.range = new Range(
                        new Position(position.line, position.character - word.length),
                        position
                    );
                    cmpItem.commitCharacters = ['\n', '\t'];
                    cmpItem.documentation = '\n###\n# your comments\n###\n';
                    /* 去頭去尾並檢查內容是 def, global 或 thread */
                    const text = nextLine.text.trim();
                    if (/^(def)/.test(text)) {
                        /* 找出參數內容 */
                        const paramReg = /\((.*?)\)/.exec(text);
                        /* 如果有參數，列出來 */
                        if (paramReg && paramReg.length > 1 && !isBlank(paramReg[1])) {
                            /* 將參數給拆出來 */
                            let index = 2;
                            const param = paramReg[1]
                                .split(',')
                                .map(
                                    p =>
                                        `# @param ${p.trim()} \${${index++}|bool,int,float,number,array,pose,string|} \${${index++}:${p.trim()}}`
                                );
                            /* 組合成 Snippet */
                            cmpItem.insertText = new SnippetString(
                                `###\n# \${1:summary}\n${param.join('\n')}\n###`
                            );
                        } else {
                            /* 加入一般用的註解 */
                            cmpItem.insertText = new SnippetString(
                                '###\n# ${0}\n###'
                            );
                        }
                    } else {
                        /* 加入一般用的註解 */
                        cmpItem.insertText = new SnippetString(
                            '###\n# ${0}\n###'
                        );
                    }
                    /* 回傳 */
                    return new CompletionList([cmpItem], false);
                }
            } else if (word.startsWith('@')) {
                /* 建立 @param */
                const paramCmpItem = new CompletionItem('@param', CompletionItemKind.Snippet);
                paramCmpItem.range = new Range(
                    new Position(position.line, position.character - word.length),
                    position
                );
                paramCmpItem.commitCharacters = ['\n', '\t', ' '];
                paramCmpItem.documentation = new MarkdownString(
                    '@param `name` `type` your comments'
                );
                paramCmpItem.insertText = new SnippetString(
                    '# @param ${1:name} ${2|bool,int,float,number,array,pose,string|} ${0:comments}'
                );
                /* 建立 @returns */
                const returnCmpItem = new CompletionItem('@returns', CompletionItemKind.Snippet);
                returnCmpItem.range = new Range(
                    new Position(position.line, position.character - word.length),
                    position
                );
                returnCmpItem.commitCharacters = ['\n', '\t', ' '];
                returnCmpItem.documentation = new MarkdownString(
                    '@returns `type` your comments'
                );
                returnCmpItem.insertText = new SnippetString(
                    '# @returns ${1|void,bool,int,float,number,array,pose,string|} ${0:comments}'
                );
                /* 回傳 */
                return new CompletionList([paramCmpItem, returnCmpItem], false);
            } else {
                /* 取得符合當前輸入文字的方法 */
                const matchItems = this.scriptCmpItems.filter(
                    mthd => mthd.label.startsWith(word)
                );
                /* 將當前的編輯器中的所有方法給解析出來 */
                getCompletionItemsFromDocument(document, word, matchItems);
                /* 如果有開專案資料夾，則也將周圍的解析出來 */
                if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
                    workspace.workspaceFolders.forEach(
                        workspace => {
                            getCompletionItemsFromWorkspace(
                                workspace,
                                word,
                                matchItems,
                                document.fileName
                            );
                        }
                    );
                }
                /* 回傳集合 */
                return new CompletionList(matchItems, !(word.length > 1));
            }
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }
}