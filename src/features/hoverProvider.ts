import {
    CancellationToken,
    Hover,
    HoverProvider,
    Position,
    TextDocument,
    workspace
} from 'vscode';
//the package for URScript/API
import { ScriptMethod } from '../scriptmethod';
//parse and search keyword to create Hover
import { getHoverFromWorkspace, getHoverFromDocument } from '../codeParser';
//check string is null or empty
import { isBlank } from '../utilities/checkString';

/**
 * store the Hover item that convert from URScript (functions.json)
 */
class ScriptHover {

    /** method name */
    Name: string;
    /** converted Hover item */
    Item: Hover;

    /**
     * construct a new item
     * @param mthd the ScriptMethod that loaded from 'functions.json'
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
 * The Hover provider for URScript
 */
export class URScriptHoverProvider implements HoverProvider {

    /** store the converted Hover item from 'functions.json' */
    private scriptHovItems: ScriptHover[];

    /**
     * construct a new provider with loaded URScript
     * @param funcs loaded ScriptMethod from 'functions.json'
     */
    public constructor(funcs: ScriptMethod[]) {
        /* using 'map' to poll each ScriptMethod object in collection and convert it */
        this.scriptHovItems = funcs.map(mthd => new ScriptHover(mthd));
    }

    /**
     * search relative Hover item with keyword
     * @param document current editor of vscode
     * @param position cursor position
     * @param token the token to indicate cancellation
     */
    public async provideHover(document: TextDocument, position: Position, token: CancellationToken): Promise<Hover | undefined> {
        try {
            /* get the word range that cursor pointed. 
               E.g. 'abc|defghi' ('|' is the cursor) would get the range from 'a' to 'i' */
            let wordRange = document.getWordRangeAtPosition(position);
            /* return null if not a word */
            if (!wordRange) {
                return undefined;
            }
            /* get the word from range */
            let word = document.getText(wordRange);
            /* ensure not empty */
            if (!isBlank(word)) {
                /* ensure not in string */
                const line = document.lineAt(position);
                const inStrMat = line.text.match(`\".*${word}.*\"`);
                if (inStrMat) {
                    return undefined;
                }
                /* search stored Hover item. check something matched? */
                let matchHover = this.scriptHovItems.find(hovItem => hovItem.Name === word);
                /* return if found */
                if (matchHover) {
                    /* clear the range. it will pop hover window on other part if not clear this */
                    matchHover.Item.range = undefined;
                    /* return */
                    return matchHover.Item;
                } else {
                    /* search current editor if not in official URScript */
                    let hov = getHoverFromDocument(document, word);
                    /* search all files in workspace if both current editor and official API are nothing matched. */
                    if (!hov && workspace.workspaceFolders) {
                        /* poll each file in workspace and search it */
                        for (const fold of workspace.workspaceFolders) {
                            /* search file. except current editor that already searched */
                            hov = getHoverFromWorkspace(fold, word, document.fileName);
                            /* hover only show one window/result. break and return if found */
                            if (hov) {
                                break;
                            }
                        }
                    }
                    /* return the found hover */
                    return hov;
                }
            }
        } catch (error) {
            return undefined;
        }
    }
}