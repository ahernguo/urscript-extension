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
//the package for URScript/API
import { ScriptMethod } from '../scriptmethod';
//parse keyword to create CompletionItem
import { getCompletionItemsFromDocument, getCompletionItemsFromWorkspace } from '../codeParser';
//check string is null or empty
import { isBlank } from '../utilities/checkString';

/**
 * The CompletionItem provider for URScript
 */
export class URScriptCompletionItemProvider implements CompletionItemProvider {

    /** store the parsed item from URScript (functions.json) */
    private scriptCmpItems: CompletionItem[];

    /**
     * construct a provider. convert ScriptMethod to CompletionItem
     * @param funcs the collection of ScriptMethod that loaded from functions.json
     */
    public constructor(funcs: ScriptMethod[]) {
        this.scriptCmpItems = funcs.map(
            mthd => {
                /* create new CompletionItem with method name */
                let cmpItem = new CompletionItem(mthd.Name, CompletionItemKind.Method);
                /* detail = name(signatures) */
                cmpItem.detail = mthd.Label;
                /* the string to add automatically. 
                   the follow is ... 
                        key-in → (pop-up)CompletionItem → (tab/space/enter...)auto fill method name
                        → user key-in '(' → (pop-up)signature tip
                   so the snippet just the method name */
                cmpItem.insertText = new SnippetString(mthd.Name);
                /* add the chars to complete CompletionItem and auto fill (SnippetString) */
                cmpItem.commitCharacters = ['(', ')', ':', '\t', '\n', ' '];
                /* documentation = comments + (return/deprecated) */
                cmpItem.documentation = mthd.Documentation;
                /* return CompletionItem */
                return cmpItem;
            }
        );
    }

    /**
     * 取得自動完成項目集合
     * search current editor and URScript to provide CompletionItems for the keyword
     * @param document current editor of vscode
     * @param position the cursor position
     * @param token the token to indicate cancellation
     * @param context the context to process
     */
    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList | undefined> {
        try {
            /* get the range that current cursor pointed */
            let word = '';
            const wordRange = document.getWordRangeAtPosition(position);
            /* it is a 'keyword' if range is include more than one char */
            if (wordRange) {
                word = document.getText(
                    new Range(wordRange.start, position)
                );
            } else {
                /* get whole line if not a 'keyword'. this is to find '#' (start/stop sign of UrDoc) */
                const line = document.lineAt(position.line);
                word = line.text.trim();
            }
            /* return null when no 'keyword' or 'sign' found */
            if (isBlank(word)) {
                return undefined;
            }
            /* According to next line, pop-up a UrDoc block when keyword is a '#'.
               ensure next is not empty  */
            if (word.startsWith('#') && (document.lineCount > (position.line + 1))) {
                /* get next line */
                const nextLine = document.lineAt(position.line + 1);
                if (nextLine && !nextLine.isEmptyOrWhitespace) {
                    /* create a completion item of UrDoc for user */
                    const cmpItem = new CompletionItem('###', CompletionItemKind.Snippet);
                    cmpItem.range = new Range(
                        new Position(position.line, position.character - word.length),
                        position
                    );
                    cmpItem.commitCharacters = ['\n', '\t'];
                    cmpItem.documentation = '\n###\n# your comments\n###\n';
                    /* add snippet based on next line */
                    const text = nextLine.text.trim();
                    if (/^(def)/.test(text)) {
                        /* get parameter part (in parentheses) */
                        const paramReg = /\((.*?)\)/.exec(text);
                        /* list parameters if not empty */
                        if (paramReg && paramReg.length > 1 && !isBlank(paramReg[1])) {
                            /* split and create a interpolation string of each parameter */
                            let index = 2;
                            const param = paramReg[1]
                                .split(',')
                                .map(
                                    p =>
                                        `# @param ${p.trim()} \${${index++}|bool,int,float,number,array,pose,string|} \${${index++}:${p.trim()}}`
                                );
                            /* combine to snippet. first part is summary comment. next followed is parameters (one as one line) */
                            cmpItem.insertText = new SnippetString(
                                `###\n# \${1:summary}\n${param.join('\n')}\n###`
                            );
                        } else {
                            /* no parameters. just put '###' part */
                            cmpItem.insertText = new SnippetString(
                                '###\n# ${0}\n###'
                            );
                        }
                    } else {
                        /* not 'def' block. just put '###' for user */
                        cmpItem.insertText = new SnippetString(
                            '###\n# ${0}\n###'
                        );
                    }
                    /* return a single completion item for UrDoc suggestion. */
                    return new CompletionList([cmpItem], false);
                }
            } else if (word.startsWith('@')) {
                /* '@' is part of UrDoc. list tips for user */
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
                /* add @returns */
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
                /* return parts of UrDoc of CompletionItem */
                return new CompletionList([paramCmpItem, returnCmpItem], false);
            } else {
                /* search URScript that start with the keyword */
                const matchItems = this.scriptCmpItems.filter(
                    mthd => mthd.label.startsWith(word)
                );
                /* search all relative keyword in current editor */
                getCompletionItemsFromDocument(document, word, matchItems);
                /* search workspace (except current file) for the keyword */
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
                /* return the relative completion item of the keyword */
                return new CompletionList(matchItems, !(word.length > 1));
            }
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }
}