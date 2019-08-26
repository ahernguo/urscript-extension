//用於 vscode 的名稱解析
import { DocumentRangeFormattingEditProvider, TextDocument, FormattingOptions, CancellationToken, TextEdit, Range, Position, OnTypeFormattingEditProvider } from "vscode";

/**
 * 適用於 URScript 的文件排版供應器
 */
export class URScriptFormattingProvider implements DocumentRangeFormattingEditProvider {

    /**
     * 取得文件排版範圍的編輯項目
     * @param document vscode 當前的文字編輯器
     * @param range 欲排版的範圍
     * @param options 排版選項
     * @param token 指出是否取消動作的物件
     */
    public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {
        try {
            /* 宣告回傳使用的 TextEdit 集合 */
            const txtEdit: TextEdit[] = [];
            /* 輪詢範圍內的每一行，若有符合的條件則調整之 */
            for (let lineNo = range.start.line; lineNo <= range.end.line; lineNo++) {
                /* 取得該行的資訊 */
                const line = document.lineAt(lineNo);
                /* 如果是空白則直接往下一行 */
                if (line.isEmptyOrWhitespace) {
                    continue;
                }
                /* 檢查 '(' 與 ')' */
                const parLeft = line.text.indexOf('(');
                const parRight = line.text.indexOf(')', parLeft);
                /* 如果有成對的括號，進行排版 */
                if ((-1 < parLeft) && (parLeft < parRight)) {
                    //取出括號內的文字
                    const paraStr = line.text.substring(parLeft + 1, parRight);
                    //利用逗號進行分割並去頭去尾
                    const paraAry = paraStr.split(',').map(word => word.trim());
                    //重新組成字串，逗號後方加上空白
                    const newStr = paraAry.join(', ');
                    //加入要回傳的集合
                    txtEdit.push(
                        new TextEdit(
                            new Range(
                                lineNo,
                                parLeft + 1,
                                lineNo,
                                parRight
                            ),
                            newStr
                        )
                    );
                }
            }
            /* 回傳 */
            return txtEdit;
        } catch (error) {
            return [];
        }
    }
}

/**
 * 適用於 URScript 的即時排版供應器。
 * 啟動 VSCode 全域選項 `editor.formatOnType` 後，於按下指定按鍵後觸發
 */
export class URScriptOnTypeFormattingProvider implements OnTypeFormattingEditProvider {

    /**
     * 取得指定範圍的排版編輯項目
     * @param document vscode 當前的文字編輯器
     * @param position 當前文字插入點的位置
     * @param ch 文字插入點的上一個字元
     * @param options 排版選項
     * @param token 指出是否取消動作的物件
     */
    public async provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[]> {
        try {
            /* 宣告回傳使用的 TextEdit 集合 */
            const edits: TextEdit[] = [];
            /* 取得該行的資訊 */
            const line = (ch === '\n') ? document.lineAt(position.line - 1) : document.lineAt(position);
            /* 如果是空白則直接往離開 */
            if (line.isEmptyOrWhitespace) {
                return [];
            }
            /* 檢查 '(' 與 ')' */
            const parLeft = line.text.indexOf('(');
            const parRight = line.text.indexOf(')', parLeft);
            /* 如果有成對的括號，進行排版 */
            if ((-1 < parLeft) && (parLeft < parRight)) {
                //取出括號內的文字
                const paraStr = line.text.substring(parLeft + 1, parRight);
                //利用逗號進行分割並去頭去尾
                const paraAry = paraStr.split(',').map(word => word.trim());
                //重新組成字串，逗號後方加上空白
                const newStr = paraAry.join(', ');
                //加入要回傳的集合
                edits.push(
                    new TextEdit(
                        new Range(
                            line.lineNumber,
                            parLeft + 1,
                            line.lineNumber,
                            parRight
                        ),
                        newStr
                    )
                );
            }
            /* 回傳 */
            return edits;
        } catch (error) {
            return [];
        }
    }

}