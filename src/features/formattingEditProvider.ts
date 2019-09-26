//用於 vscode 的名稱解析
import {
    DocumentRangeFormattingEditProvider,
    TextDocument,
    FormattingOptions,
    CancellationToken,
    TextEdit,
    Range,
    Position,
    TextLine
} from "vscode";

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
 * 需要一同考慮的符號前後文或比對
 */
interface ISignInclude {
    /**
     * 欲考慮比對的位置
     */
    readonly Position: IncludePosition;
    /**
     * 搜尋模板
     */
    readonly Pattern: string | RegExp;
    /**
     * 符合條件時要進行的排版動作
     */
    readonly Action: FormatAction;
}

/**
 * 需要一同考慮的符號前後文字
 */
class SignIncludeString implements ISignInclude {
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
    constructor(
        pos: IncludePosition,
        pat: string,
        act: FormatAction = FormatAction.AddSpace
    ) {
        this.Position = pos;
        this.Pattern = pat;
        this.Length = pat.length;
        this.Action = act;
    }
}

/**
 * 需要一同考慮的符號前後匹配
 */
class SignIncludeRegex implements ISignInclude {
    /** 欲考慮的位置。由於使用 `indexOf` 搜尋符號，故請以符號位置為基準，設定 Pattern 屬於前、後或都有 */
    readonly Position: IncludePosition;
    /** 欲考慮的搜尋模板 */
    readonly Pattern: RegExp;
    /** 符合條件時要進行的排版動作 */
    readonly Action: FormatAction;

    /**
     * 建構考慮內容
     * @param pos 考慮的位置
     * @param pat 搜尋樣板
     * @param act 排版動作
     */
    constructor(
        pos: IncludePosition,
        pat: RegExp,
        act: FormatAction = FormatAction.AddSpace
    ) {
        this.Position = pos;
        this.Pattern = pat;
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
    Includes: ISignInclude[];
    /** `Sign` 的長度 */
    Length: number;

    /**
     * 建構符號排版樣板
     * @param sign 符號
     * @param ex 包含的樣板集合
     */
    constructor(sign: string, ex: ISignInclude[]) {
        this.Sign = sign;
        this.Includes = ex;
        this.Length = sign.length;
    }
}

/**
 * 處理考慮後的結果
 */
class IncludeResult {
    /** 匹配的起始索引 */
    Start: number;
    /** 匹配的終止索引 */
    End: number;
    /** 匹配的字串 */
    Word: string;

    /**
     * 建構考慮後的結果
     * @param s 匹配的起始索引
     * @param e 匹配的終止索引
     * @param word 匹配的字串
     */
    constructor(s: number, e: number, word: string) {
        this.Start = s;
        this.End = e;
        this.Word = word;
    }
}

/**
 * 適用於 URScript 的文件排版供應器
 */
export class URScriptFormattingProvider
    implements DocumentRangeFormattingEditProvider {

    /** 用於排版括弧內容的樣板集合 */
    private static BracketPatterns: { Start: string; End: string }[] = [
        { Start: "(", End: ")" },
        { Start: "[", End: "]" }
    ];

    /** 用於符號排版，前後加上空白的樣板集合 */
    private static SignPatterns: SignPattern[] = [
        new SignPattern("=", [
            new SignIncludeString(IncludePosition.Both, "="), // ==
            new SignIncludeString(IncludePosition.Both, ">"), // >=, =>
            new SignIncludeString(IncludePosition.Both, "<")  // <=, =<
        ]),
        new SignPattern(">", [
            new SignIncludeString(IncludePosition.Both, ">"), // >>
            new SignIncludeString(IncludePosition.Both, "=")  // >=, =>
        ]),
        new SignPattern("<", [
            new SignIncludeString(IncludePosition.Both, "<"), // <<
            new SignIncludeString(IncludePosition.Both, "=")  // <=, =<
        ]),
        new SignPattern("+", [
            new SignIncludeString(IncludePosition.Both, "+", FormatAction.Ignore) //++
        ]),
        new SignPattern("-", [
            new SignIncludeString(IncludePosition.Both, "-", FormatAction.Ignore),  //--
            new SignIncludeRegex(IncludePosition.After, /-\d+/, FormatAction.Ignore)//-123
        ]),
        new SignPattern("*", []),
        new SignPattern("/", [
            new SignIncludeRegex(IncludePosition.After, /\/\w+/, FormatAction.Ignore) // http://192
        ])
    ];

    /**
     * 搜尋括弧內容並排版
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     * @param pattern 欲搜尋並處理的樣板
     * @returns (true)未閉鎖的括弧，可能是多行式方法 (false)已完成閉鎖或非括弧
     */
    private formatBracket(
        editColl: TextEdit[],
        line: TextLine,
        pattern: { Start: string; End: string }
    ): boolean {
        /* 回傳值 */
        let unclosed = false;
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
                const paraAry = paraStr.split(",").map(word => word.trim());
                //重新組成字串，逗號後方加上空白
                const newStr = paraAry.join(", ");
                //加入要回傳的集合
                editColl.push(
                    new TextEdit(
                        new Range(line.lineNumber, left + 1, line.lineNumber, right),
                        newStr
                    )
                );
                /* 重設 searchIndex，從 right 之後繼續搜尋 */
                searchIndex = right;
            } else {
                /* 沒有成對的括弧，直接離開 */
                unclosed = true;
                break;
            }
        }
        /* 回傳 */
        return unclosed;
    }

    /**
     * 搜尋符號並於前後加上空白
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     * @param pattern 欲搜尋並處理的樣板
     */
    private formatSign(
        editColl: TextEdit[],
        line: TextLine,
        pattern: SignPattern
    ) {
        /* 從第一個字開始搜尋 */
        let searchIndex = 0;
        /* 開始搜尋，找不到符號時再離開 */
        while (true) {
            /* 檢查符號位置 */
            const index = line.text.indexOf(pattern.Sign, searchIndex);
            /* 如果有東西，進行排版 */
            if (index > -1) {
                /* 檢查此符號前面是否有註解符號 */
                const cmtSign = line.text.indexOf("#");
                /* 如果 '#' 在 index 之前，直接往下一個進行 */
                if (cmtSign < index) {
                    /* 重設 searchIndex，從 end 之後繼續搜尋 */
                    searchIndex = index + 1;
                    continue;
                }
                /* 如果前後已經有空白，不用補、直接離開即可 */
                if (
                    line.text.charAt(index - 1) === " " &&
                    line.text.charAt(index + 1) === " "
                ) {
                    /* 重設 searchIndex，從 end 之後繼續搜尋 */
                    searchIndex = index + 1;
                    continue;
                } else {
                    /* 樣板位置與 Pattern，先以當前不考慮前後的情況下預設數值 */
                    let match = new IncludeResult(
                        index,
                        index + pattern.Length,
                        pattern.Sign
                    );
                    let procMatch: IncludeResult | undefined;
                    let act = FormatAction.AddSpace;
                    /* 輪詢每一個要考慮的內容，如果有符合的就儲存到 sign */
                    pattern.Includes.forEach(ex => {
                        if (!procMatch) {
                            /* 依照匹配類型進行處理 */
                            switch (ex.Position) {
                                case IncludePosition.After:
                                    procMatch = this.processAfter(line.text, index, pattern, ex);
                                    break;
                                case IncludePosition.Before:
                                    procMatch = this.processBefore(line.text, index, pattern, ex);
                                    break;
                                default:
                                    procMatch = this.processBoth(line.text, index, pattern, ex);
                                    break;
                            }
                            /* 如果有找到東西，儲存動作 */
                            if (procMatch) {
                                match.Start = procMatch.Start;
                                match.End = procMatch.End;
                                match.Word = procMatch.Word;
                                act = ex.Action;
                            }
                        }
                    });
                    /* 如果符合的條件是忽略，則直接往下搜尋 */
                    if ((act as FormatAction) === FormatAction.Ignore) {
                        /* 重設 searchIndex，從 end 之後繼續搜尋 */
                        searchIndex = match.End;
                        continue;
                    }
                    /* 如果前後都不是空白，直接補上雙空白 */
                    if (
                        line.text.charAt(match.Start - 1) !== " " &&
                        line.text.charAt(match.End) !== " "
                    ) {
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber,
                                    match.Start,
                                    line.lineNumber,
                                    match.End
                                ),
                                ` ${match.Word} `
                            )
                        );
                    } else if (line.text.charAt(match.Start - 1) !== " ") {
                        /* 如果前面不是空白、後面是，則補上前面即可 */
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber,
                                    match.Start,
                                    line.lineNumber,
                                    match.End
                                ),
                                ` ${match.Word}`
                            )
                        );
                    } else if (line.text.charAt(match.End) !== " ") {
                        /* 如果前面是空白、後面不是，則補上後面即可 */
                        editColl.push(
                            new TextEdit(
                                new Range(
                                    line.lineNumber,
                                    match.Start,
                                    line.lineNumber,
                                    match.End
                                ),
                                `${match.Word} `
                            )
                        );
                    } // else 表示前後都是空白，直接跳過

                    /* 重設 searchIndex，從 end 之後繼續搜尋 */
                    searchIndex = match.End;
                }
            } else {
                /* 已經沒有對應的符號，離開吧~ */
                break;
            }
        }
    }

    /**
     * 處理於符號後方的匹配檢查
     * @param text 欲檢查的文字
     * @param pattern 欲檢查的樣板
     * @param inc 欲考慮物件
     * @param index 欲開始檢查的索引
     * @returns 匹配的結果
     */
    private processAfter(
        text: string,
        index: number,
        pattern: SignPattern,
        inc: ISignInclude
    ): IncludeResult | undefined {
        if (inc instanceof SignIncludeString) {
            //取得在符號後的文字
            const aftWord = text.substr(index + 1, inc.Length);
            //如果有成功找到，回傳結果
            if (aftWord === inc.Pattern) {
                return new IncludeResult(
                    index,
                    index + inc.Length + pattern.Length,
                    pattern.Sign.concat(inc.Pattern)
                );
            }
        } else if (inc instanceof SignIncludeRegex) {
            //取得在符號後的文字
            const aftString = text.substring(index);
            //Regex 比對
            const match = inc.Pattern.exec(aftString);
            //如果有成功找到，回傳結果
            if (match) {
                return new IncludeResult(index, index + match[0].length, match[0]);
            }
        }
    }

    /**
     * 處理於符號前方的匹配檢查
     * @param text 欲檢查的文字
     * @param pattern 欲檢查的樣板
     * @param inc 欲考慮物件
     * @param index 欲開始檢查的索引
     * @returns 匹配的結果
     */
    private processBefore(
        text: string,
        index: number,
        pattern: SignPattern,
        inc: ISignInclude
    ): IncludeResult | undefined {
        if (inc instanceof SignIncludeString) {
            //取得在符號前的文字
            const befWord = text.substring(index - inc.Length, index);
            //如果有成功找到，回傳結果
            if (befWord === inc.Pattern) {
                return new IncludeResult(
                    index - inc.Length,
                    index + pattern.Length,
                    inc.Pattern.concat(pattern.Sign)
                );
            }
        } else if (inc instanceof SignIncludeRegex) {
            //取得在符號後的文字
            const befString = text.substring(0, index + pattern.Length);
            //Regex 比對
            const match = inc.Pattern.exec(befString);
            //如果有成功找到，回傳結果
            if (match) {
                return new IncludeResult(
                    index - match[match.length - 1].length + 1,
                    index + pattern.Length,
                    match[match.length - 1]
                );
            }
        }
    }

    /**
     * 處理於符號前面與後方的匹配檢查
     * @param text 欲檢查的文字
     * @param pattern 欲檢查的樣板
     * @param inc 欲考慮物件
     * @param index 欲開始檢查的索引
     * @returns 匹配的結果
     */
    private processBoth(
        text: string,
        index: number,
        pattern: SignPattern,
        inc: ISignInclude
    ): IncludeResult | undefined {
        /* 先看後面，比較常用 */
        const aftMatch = this.processAfter(text, index, pattern, inc);
        if (aftMatch) {
            return aftMatch;
        }
        /* 再看前面 */
        const befMatch = this.processBefore(text, index, pattern, inc);
        if (befMatch) {
            return befMatch;
        }
    }

    /**
     * 取得當前的縮排空白數量
     * @param line 欲計算空白數量的行
     * @returns 空白的數量
     */
    private getIndent(line: TextLine): number {
        const match = line.text.match(/^\s*/g);
        return match ? match[0].length : 0;
    }

    /**
     * 修正當前的縮排空白數量
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     * @param count 正確的縮排空白數量
     */
    private setIndent(editColl: TextEdit[], line: TextLine, count: number) {
        const newText = `${" ".repeat(count)}${line.text.trim()}`;
        editColl.push(new TextEdit(line.range, newText));
    }

    /**
     * 檢查當前行是否需要增加縮排數量 (從下一行起)
     * @param line 欲檢查的文字行
     * @returns (true)需增加縮排 (false)不需增加
     */
    private needIncreaseIndent(line: TextLine): boolean {
        const match = line.text.match(/\b(def|thread|while|for|if|elif|else).*:/g);
        return match ? match.length > 0 : false;
    }

    /**
     * 檢查當前行是否需要減少縮排數量 (從下一行起)
     * @param line 欲檢查的文字行
     * @returns (true)要減少縮排數量 (false)不須減少
     */
    private needDecreaseIndent(line: TextLine): boolean {
        /* 初始化回傳值 */
        let need = false;
        /* 先用 Regex 檢查是否有指定的符號  */
        const match = line.text.match(/\b(end)|(elif.*:)|(else:)/g);
        need = match ? match.length > 0 : false;
        /* 如果沒有指定的符號，檢查是否有 '單一' 的括弧結尾，表示使用者使用了多行式的內容 */
        if (!need) {
            need = URScriptFormattingProvider.BracketPatterns.some(
                pat => {
                    /* 起始括弧 */
                    const startPat = line.text.indexOf(pat.Start);
                    /* 結尾括弧 */
                    const endPat = line.text.indexOf(pat.End);
                    /* 如果沒有起始但是有結尾，表示多行內容結束了 */
                    return (startPat === -1) && (endPat > -1);
                }
            );
        }
        return need;
    }

    /**
     * 檢查右側是否有多餘空白，如有則進行刪除
     * @param editColl 欲儲存所有文字變更的集合
     * @param line 當前的文字行
     */
    private trimRight(editColl: TextEdit[], line: TextLine) {
        if (/\s$/.test(line.text)) {
            editColl.push(new TextEdit(line.range, line.text.trimRight()));
        }
    }

    /**
     * 取得文件排版範圍的編輯項目
     * @param document vscode 當前的文字編輯器
     * @param range 欲排版的範圍
     * @param options 排版選項
     * @param token 指出是否取消動作的物件
     * @returns 要更改的排版內容
     */
    public async provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        try {
            /* 宣告回傳使用的 TextEdit 集合 */
            const txtEdit: TextEdit[] = [];
            /* 縮排紀錄 */
            let indent = 0;
            /* 輪詢範圍內的每一行，若有符合的條件則調整之 */
            for (let lineNo = range.start.line; lineNo <= range.end.line; lineNo++) {
                /* 取得該行的資訊 */
                const line = document.lineAt(lineNo);
                /* 如果是空白則直接往下一行 */
                if (line.isEmptyOrWhitespace) {
                    continue;
                }
                /* 如果此行是註解，直接檢查前面縮排就好。若是內容則判斷之 */
                const isCmt = /^(#|\$).*/.test(line.text);
                let unclosed = false;
                if (!isCmt) {
                    /* 輪詢括弧樣板 */
                    URScriptFormattingProvider.BracketPatterns.forEach(
                        pat => {
                            /* 不要直接等於，避免把它洗回 false */
                            if (this.formatBracket(txtEdit, line, pat)) {
                                unclosed = true;
                            }
                        }
                    );
                    /* 輪詢符號樣板 */
                    URScriptFormattingProvider.SignPatterns.forEach(
                        pat => this.formatSign(txtEdit, line, pat)
                    );
                    /* 優先檢查是否是 end，因 end 也要往前減少縮排 */
                    if (this.needDecreaseIndent(line)) {
                        indent = indent >= options.tabSize ? indent - options.tabSize : 0;
                    }
                }
                /* 檢查當前縮排是否正確 */
                if (this.getIndent(line) !== indent) {
                    this.setIndent(txtEdit, line, indent);
                } else {
                    /* 因 setIndent 已會進行去頭去尾，故若左側縮排正確，再額外檢查右側多餘空白即可 */
                    this.trimRight(txtEdit, line);
                }
                /* 如果此行是方法或區塊，將 indent + 2 */
                if (!isCmt && (unclosed || this.needIncreaseIndent(line))) {
                    indent += options.tabSize;
                }
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
    public async provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        try {
            /* 宣告回傳使用的 TextEdit 集合 */
            const edits: TextEdit[] = [];
            /* 取得該行的資訊 */
            const line =
                ch === "\n"
                    ? document.lineAt(position.line - 1)
                    : document.lineAt(position);
            /* 如果是空白則直接往離開 */
            if (line.isEmptyOrWhitespace) {
                return [];
            }
            /* 輪詢括弧樣板 */
            URScriptFormattingProvider.BracketPatterns.forEach(pat =>
                this.formatBracket(edits, line, pat)
            );
            /* 輪詢符號樣板 */
            URScriptFormattingProvider.SignPatterns.forEach(pat =>
                this.formatSign(edits, line, pat)
            );
            /* 檢查右側是否有多餘的空白並刪除之 */
            this.trimRight(edits, line);
            /* 回傳 */
            return edits;
        } catch (error) {
            return [];
        }
    }
}
