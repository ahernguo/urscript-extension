//用於 vscode 的名稱解析
import {
    CancellationToken,
    DocumentSymbol,
    DocumentSymbolProvider,
    TextDocument,
} from "vscode";
//用於解析程式碼以提供相關物件的解析
import { getSymbolsFromDocument } from "../codeParser";

/**
 * 適用於 URScript 的文件符號解析
 */
export class URScriptDocumentSymbolProvider implements DocumentSymbolProvider {

    /**
     * 搜尋當前文件的符號，以副程式為主
     * @param document vscode 當前的文字編輯器
     * @param token 指出是否取消動作的物件
     */
    public async provideDocumentSymbols(document: TextDocument, token: CancellationToken): Promise<DocumentSymbol[] | undefined> {
        try {
            /* 尋找文件內容 */
            const symbols = getSymbolsFromDocument(document);
            /* 如果有找到東西，則回傳之 */
            if (symbols.length > 0) {
                return symbols;
            }
        } catch (error) {
            return undefined;
        }
    }
}