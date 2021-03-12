import {
    CancellationToken,
    DocumentSymbol,
    DocumentSymbolProvider,
    TextDocument,
} from "vscode";
//tools for search symbol
import { getSymbolsFromDocument } from "../codeParser";

/**
 * The DocumentSymbol provider for URScript
 */
export class URScriptDocumentSymbolProvider implements DocumentSymbolProvider {

    /**
     * search all method in current editor to make a DocumentSymbol
     * @param document current editor of vscode
     * @param token the token to indicate cancellation
     */
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<DocumentSymbol[] | undefined> {
        try {
            /* search all methods from current editor */
            const symbols = getSymbolsFromDocument(document);
            /* return the collection if something found */
            if (symbols.length > 0) {
                return symbols;
            }
        } catch (error) {
            return undefined;
        }
    }
}