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
     * Parse human-readable commit characters from setting into actual characters
     * @param chars the string array from setting
     */
    private parseCommitCharacters(chars: string[]): string[] {
        return chars.map(char => {
            switch (char.trim().toLowerCase()) {
                case '\\t':
                case 'tab':
                    return '\t';
                case '\\n':
                case 'enter':
                case 'newline':
                    return '\n';
                case '\\v':
                case 'verticaltab':
                    return '\v';
                case '\\b':
                case 'backspace':
                    return '\b';
                case '\\r':
                case 'return':
                    return '\r';
                case '\\f':
                case 'formfeed':
                    return '\f';
                case '\\a':
                case 'alert':
                    return '\a';
                case '\\\\':
                case 'backslash':
                    return '\\';
                case '\\?':
                case 'question':
                    return '?';
                case '\\\'':
                case 'quote':
                case 'singlequote':
                    return '\'';
                case '\\\"':
                case 'doublequote':
                    return '\"';
                case 'space':
                case 'blank':
                    return ' ';
                default:
                    return char;
            }
        });
    }

    /**
     * construct a provider. convert ScriptMethod to CompletionItem
     * @param funcs the collection of ScriptMethod that loaded from functions.json
     */
    public constructor(funcs: ScriptMethod[]) {
        /* get commit characters setting from VSCode setting page. the section name must same as package.json/contributes/configuration */
        const config = workspace.getConfiguration('urscript');
        const methodCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.methodCommitCharacters', ['(', ')', ':', '\\t', '\\n', 'Space']));
        const keywordCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.keywordCommitCharacters', ['\\t', '\\n', 'Space']));

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
                cmpItem.commitCharacters = methodCommitChars;
                /* documentation = comments + (return/deprecated) */
                cmpItem.documentation = mthd.Documentation;
                /* set sort priority to lower ('m' means 'method').
                   let keyword 'k' higher than this. */
                cmpItem.sortText = 'm';
                /* return CompletionItem */
                return cmpItem;
            }
        );
        /* [#20](https://github.com/ahernguo/urscript-extension/issues/20) Request for 'end' completion. */
        let endCompItem = new CompletionItem('end', CompletionItemKind.Keyword);
        endCompItem.insertText = new SnippetString('end');
        endCompItem.commitCharacters = keywordCommitChars;
        endCompItem.sortText = 'k';    //set first priority. 'k' means 'keyword'
        this.scriptCmpItems.push(endCompItem);
    }

    /**
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

            /* get commit characters setting from VSCode setting page.
                the section name must same as package.json/contributes/configuration
                this function is called when runtime. get config here can read latest setting without restart VSCode */
            const config = workspace.getConfiguration('urscript');
            const urdocCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.urdocCommitCharacters', ['\\n', '\\t']));
            const urdocTagCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.urdocTagCommitCharacters', ['\\n', '\\t', 'Space']));

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
                    cmpItem.commitCharacters = urdocCommitChars;
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
                                    p => {
                                        if (/=.+/.test(p)) {
                                            const pnReg = /.*(?==)/.exec(p);
                                            if (pnReg) {
                                                return `# @param ${pnReg[0].trim()} \${${index++}|bool,int,float,number,array,pose,string,struct,matrix|} \${${index++}:${pnReg[0].trim()}}`;
                                            }
                                        } else {
                                            return `# @param ${p.trim()} \${${index++}|bool,int,float,number,array,pose,string,struct,matrix|} \${${index++}:${p.trim()}}`;
                                        }
                                    }
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
                paramCmpItem.commitCharacters = urdocTagCommitChars;
                paramCmpItem.documentation = new MarkdownString(
                    '@param `name` `type` your comments'
                );
                paramCmpItem.insertText = new SnippetString(
                    '# @param ${1:name} ${2|bool,int,float,number,array,pose,string,struct,matrix|} ${0:comments}'
                );
                /* add @returns */
                const returnCmpItem = new CompletionItem('@returns', CompletionItemKind.Snippet);
                returnCmpItem.range = new Range(
                    new Position(position.line, position.character - word.length),
                    position
                );
                returnCmpItem.commitCharacters = urdocTagCommitChars;
                returnCmpItem.documentation = new MarkdownString(
                    '@returns `type` your comments'
                );
                returnCmpItem.insertText = new SnippetString(
                    '# @returns ${1|void,bool,int,float,number,array,pose,string,struct,matrix|} ${0:comments}'
                );
                /* return parts of UrDoc of CompletionItem */
                return new CompletionList([paramCmpItem, returnCmpItem], false);
            } else {
                /* search URScript that start with the keyword */
                const matchItems = this.scriptCmpItems.filter(
                    mthd => mthd.label.startsWith(word)
                );

                /* this function is called when runtime.
                    get config here can read latest setting without restart VSCode */
                const methodCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.methodCommitCharacters', ['(', ')', ':', '\\t', '\\n', 'Space']));
                const keywordCommitChars = this.parseCommitCharacters(config.get<string[]>('autocomplete.keywordCommitCharacters', ['\\t', '\\n', 'Space']));
                matchItems.forEach(item => {
                    item.commitCharacters = item.kind === CompletionItemKind.Method ? methodCommitChars : keywordCommitChars;
                });

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