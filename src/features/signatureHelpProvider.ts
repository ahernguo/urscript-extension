import {
    CancellationToken,
    ParameterInformation,
    Position,
    SignatureHelp,
    SignatureHelpContext,
    SignatureHelpProvider,
    SignatureHelpProviderMetadata,
    SignatureInformation,
    TextDocument,
    workspace
} from 'vscode';
//the package for URScript/API
import { ScriptMethod } from '../scriptmethod';
//check object is null or empty
import { isNullOrUndefined } from 'util';
//parse and search keyword to create Signature
import { getSignatureFromWorkspace, getSignatureFromDocument } from '../codeParser';

/**
 * store the SignatureHelp item that convert from URScript (functions.json)
 */
class ScriptSignature {

    /** method name */
    Name: string;
    /** converted SignatureHelp item */
    Item: SignatureHelp;

    /**
     * construct a new item
     * @param mthd the ScriptMethod that loaded from 'functions.json'
     */
    constructor(mthd: ScriptMethod) {
        /* create new information with 'name(signaures)' */
        const sigInfo = new SignatureInformation(mthd.Label);
        /* create parameters */
        const sigPara = mthd.Parameters.map(
            para => {
                let paraInfo = new ParameterInformation(para.Label);
                paraInfo.documentation = para.Documentation;
                return paraInfo;
            }
        );
        sigInfo.parameters = sigPara;
        /* create SignatureHelp */
        const sigHelp = new SignatureHelp();
        sigHelp.activeParameter = 0;
        sigHelp.activeSignature = 0;
        sigHelp.signatures = [sigInfo];
        /* store it */
        this.Item = sigHelp;
        this.Name = mthd.Name;
    }
}

/**
 * The SignatureHelp provider for URScript
 */
export class URScriptSignatureHelpProvider implements SignatureHelpProvider {

    /** store the converted SignatureHelp item from 'functions.json' */
    private scriptSignatures: ScriptSignature[];

    /**
     * construct a new provider with loaded URScript
     * @param funcs loaded ScriptMethod from 'functions.json'
     */
    public constructor(funcs: ScriptMethod[]) {
        this.scriptSignatures = funcs.map(mthd => new ScriptSignature(mthd));
    }

    /**
     * search relative SignatureHelp item with keyword
     * @param document current editor of vscode
     * @param position cursor position
     * @param token the token to indicate cancellation
     * @param context the context of signature from vscode
     */
    public async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken, context: SignatureHelpContext): Promise<SignatureHelp | undefined> {
        try {
            /* get current line text */
            const line = document.lineAt(position);
            /* check whether contains '('. using this to search parameters after method name */
            const parLeft = line.text.indexOf('(');
            /* check whether any ')' followed '('. it is a end sign of parameters */
            const parRight = line.text.indexOf(')', parLeft);
            /* return null if range between '(' and ')' is incorrect */
            if ((position.character < parLeft) || (parRight < position.character)) {
                return undefined;
            }
            /* the context has the history of signature window.
               return next signature if retrigger (',' or '←' or '→' pressed) */
            if (context.isRetrigger && !isNullOrUndefined(context.activeSignatureHelp)) {
                /* count how many ',' exist */
                //get the string in parentheses. start from next '(' and stop to ')'
                const paraStr = line.text.substr(parLeft + 1, position.character - parLeft - 1);
                //splitted with ','. the paraAry.Len shows how many ',' are keyed
                const paraAry = paraStr.split(',');
                /* change the index to next one. (zero based) */
                context.activeSignatureHelp.activeParameter = paraAry.length - 1;
                /* return current signature. it will shift the signature window to next one (not re-pop it) */
                return context.activeSignatureHelp;
            } else {
                /* search keyword if not retriggered */
                /* get the range from line start to '('. In general, the word before '(' is method name */
                const wordRange = document.getWordRangeAtPosition(
                    new Position(line.lineNumber, parLeft - 1)
                );
                /* get the word of range */
                const word = document.getText(wordRange);
                /* search stored item that something matched */
                const matched = this.scriptSignatures.find(sig => sig.Name === word);
                /* reset the index to first (index is zero based) if official API found */
                if (matched) {
                    matched.Item.activeParameter = 0;
                    matched.Item.activeSignature = 0;
                    /* return it */
                    return matched.Item;
                } else {
                    /* search current editor if no official API found */
                    let sigHelp = getSignatureFromDocument(document, word);
                    /* search all files in workspace if both current editor and official API are mismatch */
                    if (!sigHelp && workspace.workspaceFolders) {
                        /* poll each file from workspace */
                        for (const fold of workspace.workspaceFolders) {
                            /* search keyword and convert to SignatureHelp */
                            sigHelp = getSignatureFromWorkspace(fold, word, document.fileName);
                            /* signature only show one window/result. break and return if found */
                            if (sigHelp) {
                                break;
                            }
                        }
                    }
                    /* return found */
                    return sigHelp;
                }
            }
        } catch (error) {
            return undefined;
        }
    }
}

/**
 * The SignatureHelp trigger provider for URScript
 */
export class URScriptSignatureHelpProviderMetadata implements SignatureHelpProviderMetadata {

    /** the keys to trigger SignatureHelp window */
    triggerCharacters: string[];
    /** the keys to trigger SignatureHelp shift to next parameter */
    retriggerCharacters: string[];

    /**
     * construct the provider
     */
    constructor() {
        this.triggerCharacters = ['('];
        this.retriggerCharacters = [','];
    }
}