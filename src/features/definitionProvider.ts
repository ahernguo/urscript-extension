//用於 vscode 的名稱解析
import {
    CancellationToken,
    DefinitionProvider,
    Location,
    LocationLink,
    Position,
    TextDocument,
    workspace
} from "vscode";
//用於解析程式碼以提供相關物件的解析
import { getLocationFromWorkspace, getLocationFromDocument } from "../codeParser";
//檢查字串是否為空字串
import { isBlank } from "../utilities/checkString";

/**
 * 適用於 URScript 的尋找定義供應器
 */
export class URScriptDefinitionProvider implements DefinitionProvider {

    /**
     * 搜尋當前滑鼠停留的定義
     * @param document vscode 當前的文字編輯器
     * @param position 當前滑鼠的座標
     * @param token 指出是否取消動作的物件
     */
    public async provideDefinition(document: TextDocument, position: Position, token: CancellationToken): Promise<Location | Location[] | LocationLink[] | undefined> {
        try {
            /* 取得當前滑鼠所停留位置是否有字詞(前後為符號或空白則認定字詞)，如果有則取得其字詞範圍 */
            let wordRange = document.getWordRangeAtPosition(position);
            /* 如果滑鼠指到奇怪的地方，就不理他囉 */
            if (!wordRange) {
                return undefined;
            }
            /* 取得停留位置上的字詞 */
            let word = document.getText(wordRange);
            /* 如果有東西，則進行搜尋比對 */
            if (!isBlank(word)) {
                /* 先從當前的文件找起 */
                let locColl = getLocationFromDocument(document, word);
                /* 當前文件找不到，往 Workspace 開找 */
                if (locColl.length === 0 && workspace.workspaceFolders) {
                    /* 輪詢各個資料夾 */
                    for (const fold of workspace.workspaceFolders) {
                        /* 嘗試找出定義 */
                        const wpLoc = getLocationFromWorkspace(fold, word, document.fileName);
                        /* 如果有則離開並回傳 */
                        if (wpLoc.length > 0) {
                            wpLoc.forEach(l => locColl.push(l));
                        }
                    }
                }
                /* 回傳 */
                return locColl;
            }
        } catch (error) {
            return undefined;
        }
    }

}