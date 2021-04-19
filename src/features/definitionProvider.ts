import {
    CancellationToken,
    DefinitionProvider,
    Location,
    LocationLink,
    Position,
    TextDocument,
    workspace
} from "vscode";
//tools for search location
import { getLocationFromWorkspace, getLocationFromDocument } from "../codeParser";
//check string is null or empty
import { isBlank } from "../utilities/checkString";

/**
 * The Definition/Location provider for URScript
 */
export class URScriptDefinitionProvider implements DefinitionProvider {

    /**
     * search the location of keyword that cursor stayed
     * @param document current editor of vscode
     * @param position cursor position
     * @param token the token to indicate cancellation
     */
    public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location | Location[] | LocationLink[] | undefined> {
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
                /* search current editor */
                let locColl = getLocationFromDocument(document, word);
                /* if not found, search all files in workspace (if opened from a directory) */
                if (locColl.length === 0 && workspace.workspaceFolders) {
                    /* poll each file in the workspace */
                    for (const fold of workspace.workspaceFolders) {
                        /* search file. except current editor that already searched. */
                        const wpLoc = getLocationFromWorkspace(fold, word, document.fileName);
                        /* add to the result list if something found */
                        if (wpLoc.length > 0) {
                            wpLoc.forEach(l => locColl.push(l));
                        }
                    }
                }
                /* return the collection */
                return locColl;
            }
        } catch (error) {
            return undefined;
        }
    }

}