//用於 vscode 的名稱解析
import { DocumentRangeFormattingEditProvider, TextDocument, FormattingOptions, CancellationToken, TextEdit, Range, Position, TextLine } from "vscode";

/**
 * 額外的符號考慮位置
 */
enum IncludePosition {
    /**
     * 於符號前面需要額外考慮文字
     */
    Before,
    /**
     * 於符號後方需要額外考慮文字
     */
    After,
    /**
     * 於符號前面與後方均需額外考慮文字
     */
    Both
}

/**
 * 排版的動作
 */
enum FormatAction {
    /**
     * 不要進行排版
     */
    Ignore,
    /**
     * 於前後端加入空格
     */
    AddSpace
}

/**
 * 需要一同考慮的符號前後文字
 */
class SignInclude {

    /** 欲考慮的位置。由於使用 `indexOf` 搜尋符號，故請以符號位置為基準，設定 Pattern 屬於前、後或都有 */
    readonly Position: IncludePosition;
    /** 欲考慮的搜尋模板 */
    readonly Pattern: string;
    /** `Pattern` 的長度 */
    readonly Length: number;
    /** 符合條件時要進行的排版動作 */
    readonly Action: FormatAction;

    /**
     * 建構考慮內容
     * @param pos 考慮的位置
     * @param pat 搜尋樣板
     * @param act 排版動作
     */
    constructor(pos: IncludePosition, pat: string, act: FormatAction = FormatAction.AddSpace) {
        this.Position = pos;
        this.Pattern = pat;
        this.Length = pat.length;
        this.Action = act;
    }
}

/**
 * 符號的排版樣板
 */
class SignPattern {

    /** 符號 */
    Sign: string;
    /** 欲包含的樣板集合 */
    Includes: SignInclude[];
    /** `Sign` 的長度 */
    Length: number;

    /**
     * 建構符號排版樣板
     * @param sign 符號
     * @param ex 包含的樣板集合
     */
    constructor(sign: string, ex: SignInclude[]) {
        this.Sign = sign;
        this.Includes = ex;
        this.Length = sign.length;
    }
}

/**
 * 適用於 URScript 的文件排版供應器
 */
export class URScriptFormattingProvider implements DocumentRangeFormattingEditProvider {

    /** 用於排版括弧內容的樣板集合 */
    private static BracketPatterns: { Start: string, End: string }[] = [
        { Start: '(', End: ')' }, { Start: '[', End: ']' }
    ];

    /** 用於符號排版，前後加上空白的樣板集合 */
    private static SignPatterns: SignPattern[] = [
        new SignPattern(
            '=',
            [
                new SignInclude(IncludePosition.Both, '='), // ==
                new SignInclude(IncludePosition.Both, '>'), // >=, =>
                new SignInclude(IncludePosition.Both, '<')  // <=, =<
            ]
        ),
        new SignPattern(
            '>',
            [
                new SignInclude(IncludePosition.Both, '>'), // >>
                new SignInclude(IncludePosition.Both, '=')  // >=, =>
            ]
        ),
        new SignPattern(
            '<',
            [
                new SignInclude(IncludePosition.Both, '<'), // <<
                new SignInclude(IncludePosition.Both, '=')  // <=, =<
            ]
        ),
        new SignPattern(
            '+',
            [new SignInclude(IncludePosition.Both, '+', FormatAction.Ignore)]    //++
        ),
        new SignPattern(
            '-',
            [new SignInclude(IncludePosition.Both, '-', FormatAction.Ignore)]    //--
        ),
        new SignPattern('*', []),
        new SignPattern('/', []),
    ];

    /**
     * 搜尋括弧內容並排版
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     * @param pattern 欲搜尋並處理的樣板
     */
    private FormatBracket(editColl: TextEdit[], line: TextLine, pattern: { Start: string, End: string }) {
        /* 從第一個字開始搜尋 */
        let searchIndex = 0;
        /* 開始搜尋，直至找不到括號離開 */
        while (true) {
            /* 檢查並取得括弧位置 */
            const left = line.text.indexOf(pattern.Start, searchIndex);
            /* 如果沒有起始括弧就直接離開吧 */
            if (left === -1) {
                break;
            }
            const right = line.text.indexOf(pattern.End, left);
            /* 如果有成對的括號，進行排版 */
            if (left < right) {
                //取出括號內的文字
                const paraStr = line.text.substring(left + 1, right);
                //利用逗號進行分割並去頭去尾
                const paraAry = paraStr.split(',').map(word => word.trim());
                //重新組成字串，逗號後方加上空白
                const newStr = paraAry.join(', ');
                //加入要回傳的集合
                editColl.push(
                    new TextEdit(
                        new Range(
                            line.lineNumber, left + 1,
                            line.lineNumber, right
                        ),
                        newStr
                    )
                );
                /* 重設 searchIndex，從 right 之後繼續搜尋 */
                searchIndex = right;
            } else {
                /* 沒有成對的括弧，直接離開 */
                break;
            }
        }
    }

    /**
     * 搜尋符號並於前後加上空白
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     * @param pattern 欲搜尋並處理的樣板
     */
    private FormatSign(editColl: TextEdit[], line: TextLine, pattern: SignPattern) {
        /* 從第一個字開始搜尋 */
        let searchIndex = 0;
        /* 開始搜尋，找不到符號時再離開 */
        while (true) {
            /* 檢查符號位置 */
            const index = line.text.indexOf(pattern.Sign, searchIndex);
            /* 如果有東西，進行排版 */
            if (index > -1) {
                /* 如果前後已經有空白，不用補、直接離開即可 */
                if ((line.text.charAt(index - 1) === " ") && (line.text.charAt(index + 1) === " ")) {
                    /* 重設 searchIndex，從 end 之後繼續搜尋 */
                    searchIndex = index + 1;
                    continue;
                } else {
                    /* 樣板位置與 Pattern，先以當前不考慮前後的情況下預設數值 */
                    let sign = pattern.Sign;
                    let start = index;
                    let end = index + pattern.Length;
                    let act = FormatAction.AddSpace;
                    let found = false;
                    /* 輪詢每一個要考慮的內容，如果有符合的就儲存到 sign */
                    pattern.Includes.forEach(
                        ex => {
                            if (!found) {
                                switch (ex.Position) {
                                    case IncludePosition.After:
                                        //取得在符號後的文字
                                        const aftWord = line.text.substr(index + 1, ex.Length);
                                        //回傳符號後方的文字是否為要排除的內容
                                        if (aftWord === ex.Pattern) {
                                            start = index;
                                            end = index + ex.Length + pattern.Length;
                                            sign = pattern.Sign.concat(ex.Pattern);
                                            act = ex.Action;
                                            found = true;
                                        }
                                        break;
                                    
                                    case IncludePosition.Before:
                                        //取得在符號前的文字
                                        const befWord = line.text.substring(index - ex.Length, index);
                                        //回傳符號前面的文字是否為要排除的內容
                                        if (befWord === ex.Pattern) {
                                            start = index - ex.Length;
                                            end = index + pattern.Length;
                                            sign = ex.Pattern.concat(pattern.Sign);
                                            act = ex.Action;
                                            found = true;
                                        }
                                        break;
    
                                    default:
                                        //取得在符號後的文字
                                        const bothAftWord = line.text.substr(index + 1, ex.Length);
                                        //檢查符號後方的文字是否為要排除的內容
                                        if (bothAftWord === ex.Pattern) {
                                            start = index;
                                            end = index + ex.Length + pattern.Length;
                                            sign = pattern.Sign.concat(ex.Pattern);
                                            act = ex.Action;
                                            found = true;
                                            break;
                                        }
                                        //取得在符號前的文字
                                        const bothBefWord = line.text.substring(index - ex.Length, index);
                                        //檢查符號後方的文字是否為要排除的內容
                                        if (bothBefWord === ex.Pattern) {
                                            start = index - ex.Length;
                                            end = index + pattern.Length;
                                            sign = ex.Pattern.concat(pattern.Sign);
                                            act = ex.Action;
                                            found = true;
                                            break;
                                        }
                                        break;
                                }
                            }
                        }
                    );
                    /* 如果符合的條件是忽略，則直接往下搜尋 */
                    if ((act as FormatAction) === FormatAction.Ignore) {
                        /* 重設 searchIndex，從 end 之後繼續搜尋 */
                        searchIndex = end;
                        continue;
                    }
                    /* 如果前後都不是空白，直接補上雙空白 */
                    if (((line.text.charAt(start - 1) !== " ") && (line.text.charAt(end) !== " "))) {
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber, start,
                                    line.lineNumber, end
                                ),
                                ` ${sign} `
                            )
                        );
                    } else if (line.text.charAt(start - 1) !== " ") {
                        /* 如果前面不是空白、後面是，則補上前面即可 */
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber, start,
                                    line.lineNumber, end
                                ),
                                ` ${sign}`
                            )
                        );
                    } else if (line.text.charAt(end) !== " ") {
                        /* 如果前面是空白、後面不是，則補上後面即可 */
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber, start,
                                    line.lineNumber, end
                                ),
                                `${sign} `
                            )
                        );
                    } // else 表示前後都是空白，直接跳過

                    /* 重設 searchIndex，從 end 之後繼續搜尋 */
                    searchIndex = end;
                }
            } else {
                /* 已經沒有對應的符號，離開吧~ */
                break;
            }
        }
    }

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
                /* 輪詢括弧樣板 */
                URScriptFormattingProvider.BracketPatterns.forEach(
                    pat => this.FormatBracket(txtEdit, line, pat)
                );
                /* 輪詢符號樣板 */
                URScriptFormattingProvider.SignPatterns.forEach(
                    pat => this.FormatSign(txtEdit, line, pat)
                );
            }
            /* 回傳 */
            return txtEdit;
        } catch (error) {
            return [];
        }
    }

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
            /* 輪詢括弧樣板 */
            URScriptFormattingProvider.BracketPatterns.forEach(
                pat => this.FormatBracket(edits, line, pat)
            );
            /* 輪詢符號樣板 */
            URScriptFormattingProvider.SignPatterns.forEach(
                pat => this.FormatSign(edits, line, pat)
            );
            /* 回傳 */
            return edits;
        } catch (error) {
            return [];
        }
    }
}