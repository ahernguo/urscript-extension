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
 * 單行裡面的範圍
 */
class InLineRange {

    /** 起始索引 */
    public Start: number;
    /** 結尾索引 */
    public End: number;
    /** 由何種方式加入 ("b")括弧 ("s")符號 ("k")關鍵字 */
    public AddBy: string;

    /**
     * 建構行內範圍
     * @param start 起始
     * @param end 結尾
     * @param by 由何種方式加入 ("b")括弧 ("s")符號 ("k")關鍵字
     */
    constructor(start: number, end: number, by: string) {
        this.Start = start;
        this.End = end;
        this.AddBy = by;
    }

    /**
     * 判斷此索引是否在範圍內
     * @param index 欲檢查的索引
     */
    public InRange(index: number): boolean {
        return (this.Start <= index) && (index <= this.End);
    }
}

/**
 * 括弧的排版樣板
 */
class BracketPattern {

    /** 起始括弧 */
    public StartSign: string;
    /** 終止括弧 */
    public EndSign: string;

    /** 排除字串的起始括弧 */
    private StartPattern: RegExp;
    /** 排除字串的結尾括弧 */
    private EndPattern: RegExp;
    /** 用於取得合法逗號的 Regex */
    private static CommaPattern = /,(?=([^\"]*\"[^\"]*\")*[^\"]*$)/g;

    /**
     * 建構括弧排版樣板
     * @param start 起始括弧
     * @param end 終止括弧
     */
    constructor(start: string, end: string) {
        /* 塞入變數 */
        this.StartSign = start;
        this.EndSign = end;
        /* 組裝 Regex */
        this.StartPattern = new RegExp(
            `\\${start}(?=([^\\"]*\\"[^\\"]*\\")*[^\\"]*$)`,
            "g"
        );
        this.EndPattern = new RegExp(
            `\\${end}(?=([^\\"]*\\"[^\\"]*\\")*[^\\"]*$)`,
            "g"
        );
    }

    /**
     * 針對指定的文字行進行排版，並將排版結果存入集合中
     * @param editColl 欲儲存排版結果的集合
     * @param editRange 已處理過的位置
     * @param line 欲解析的文字行
     * @param commentIndex 註解的位置
     * @returns (0)已完全閉鎖 (1)只有起始括弧 (2)只有結尾括弧
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ): number {
        /* 宣告回傳的括弧狀態 */
        let bracketState = 0x00;
        /* 宣告集合 */
        const pair: { Start: number, End: number }[] = [];
        const start: number[] = [];
        const end: { Index: number, Matched: boolean }[] = [];
        /* 宣告暫存結果 */
        let match: RegExpExecArray | null;
        /* 尋找起始括弧 */
        while ((match = this.StartPattern.exec(line.text))) {
            /* 如果此括弧在註解前面，則加入集合 */
            if ((commentIndex < 0) || (match.index < commentIndex)) {
                start.unshift(match.index); //倒置，越後面的括號要先判斷
            }
        }
        /* 尋找結尾括弧 */
        while ((match = this.EndPattern.exec(line.text))) {
            /* 如果此括弧在註解前面，則加入集合 */
            if ((commentIndex < 0) || (match.index < commentIndex)) {
                end.push(
                    {
                        Index: match.index,
                        Matched: false
                    }
                );
            }
        }
        /* 檢查括弧閉鎖狀態 */
        if (start.length === 0 && end.length === 0) {
            return 0;   //沒有括弧
        } else if (start.length > 0 && end.length === 0) {
            return 1;   //只有起始、沒有結尾
        } else if (start.length === 0 && end.length > 0) {
            return 2;   //只有結尾、沒有起始
        } else if (start.length > end.length) {
            bracketState |= 0x01;   //開始比結束的多
        } else if (start.length < end.length) {
            bracketState |= 0x02;   //結束比開始的多
        }
        /* 找出括弧配對 */
        for (const idx of start) {
            /* 找出最近的括弧 */
            const tarIdx = end.findIndex(kvp => !kvp.Matched && idx < kvp.Index);
            /* 檢查是否有找到對應的括弧 */
            if (tarIdx > -1) {
                /* 加入集合 */
                pair.push(
                    {
                        Start: idx + 1,
                        End: end[tarIdx].Index
                    }
                );
                /* 標記為已配對，避免被重複搜尋 */
                end[tarIdx].Matched = true;
            }
        }
        /* 如果有在大括弧內，從 pair 中移除，避免重複排版 */
        const formatRange = pair.filter(
            p => !pair.some(o => (o.Start < p.Start) && (p.End < o.End))
        );
        /* 依序將配對的內容拆開並加上空白 */
        if (formatRange.length > 0) {
            for (const p of formatRange) {
                /* 取出括弧中間的內容 */
                const subStr = line.text.substring(p.Start, p.End);
                /* 由於 line.text.split(this.CommaPattern) 會取得怪怪的元素，所以只好手動分割了!! */
                const strColl: string[] = [];
                let lastIndex = 0;
                while ((match = BracketPattern.CommaPattern.exec(subStr))) {
                    strColl.push(subStr.substring(lastIndex, match.index).trim());
                    lastIndex = BracketPattern.CommaPattern.lastIndex;
                }
                /* 補上最後一段(不會被 capture 到) */
                strColl.push(subStr.substr(lastIndex).trim());
                /* 組合成字串 */
                const param = strColl.join(", ");
                /* 如果內容不同再進行排版 */
                if (subStr !== param) {
                    editColl.push(
                        new TextEdit(
                            new Range(line.lineNumber, p.Start, line.lineNumber, p.End),
                            param
                        )
                    );
                    /* 補上紀錄 */
                    editRange.push(new InLineRange(p.Start, p.End, "b"));
                }
            }
        }
        /* 回傳 */
        return bracketState;
    }
}

/**
 * 符號的排版樣板
 */
class SignPattern {

    /** 符號 */
    public Sign: string;
    /** 要排除的項目 */
    public Excludes: RegExp[] | undefined;

    /** 排除於 String 之外的 Regex */
    private NotStringPattern: RegExp;
    /** 理想的符號樣板 */
    private Ideal: string;

    /**
     * 建構符號排版之樣板
     * @param sign 符號
     * @param pattern 符號的 Regex 字串
     * @param exclude 欲排除的項目
     */
    constructor(sign: string, pattern: string, exclude?: RegExp[]) {
        this.Sign = sign;
        this.Ideal = ` ${sign} `;
        this.NotStringPattern = new RegExp(`(\\s*(${pattern})\\s*)(?=([^\\"]*\\"[^\\"]*\\")*[^\\"]*$)`, "g");
        this.Excludes = exclude;
    }

    /**
     * 針對指定的文字行進行排版，並將排版結果存入集合中
     * @param editColl 欲儲存排版結果的集合
     * @param editRange 已處理過的位置
     * @param line 欲解析的文字行
     * @param commentIndex 註解的位置
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ) {
        /* 檢查此行內是否有符合的項目 */
        let index = 0;
        let match: RegExpExecArray | null;
        while ((match = this.NotStringPattern.exec(line.text))) {
            /* 若符號在註解後面，直接往下一個繼續。此處是因為懶得用大 if 排版，所以才用 continue 😆 */
            if (commentIndex > -1 && commentIndex < match.index) {
                continue;   //不能 break !! 請看下方 260 行左右的註解
            }
            /* 檢查是否已有處理過。符號與括號不衝突，故只要考慮非括弧的來源即可 */
            index = match.index;
            const processed = editRange.some(r => r.AddBy !== "b" && r.InRange(index));
            if (processed) {
                /* 有處理過了，那就往下一筆前進吧！ */
                continue;
            }
            /* 如果有要過濾的，檢查之 */
            if (this.Excludes) {
                const exclude = this.Excludes.some(
                    ex => {
                        /* 檢查是否成立，一樣要整行都查過一遍！ */
                        let isExcluded = false;
                        let excludeResult: RegExpExecArray | null;
                        while ((excludeResult = ex.exec(line.text))) {
                            if (match &&
                                (excludeResult.index <= match.index) &&
                                (match.index <= (excludeResult.index + excludeResult[0].length))
                            ) {
                                isExcluded = true;
                                //此處不能下 break!!
                                //如果提前離開，下次 ex 會 cache 在這一行，導致判斷錯誤
                                //所以要讓它完整讀到 lastIndex === 0 才行，故直接讓他飄完吧！
                                //來源: https://stackoverflow.com/questions/10229144/bug-with-regexp-in-javascript-when-do-global-search 
                            }
                        }
                        /* 回傳 */
                        return isExcluded;
                    }
                );
                /* 如果需要被過濾，就往下一筆吧~ */
                if (exclude) {
                    continue;
                }
            }
            /* 如果取出的東西跟理想值不同，進行排版 */
            if (match[0] !== this.Ideal) {
                editColl.push(
                    new TextEdit(
                        new Range(
                            line.lineNumber,
                            match.index,
                            line.lineNumber,
                            this.NotStringPattern.lastIndex
                        ),
                        this.Ideal
                    )
                );
            }
            /* 加入已處理的範圍 */
            editRange.push(
                new InLineRange(
                    match.index,
                    this.NotStringPattern.lastIndex,
                    "s"
                )
            );
        }
    }
}

/**
 * 關鍵字的排版樣板
 */
class KeywordPattern {
    /** 關鍵字 */
    Keyword: string;
    /** 欲搜尋關鍵字的 Regex */
    Search: RegExp;
    /** 欲取代成的內容 */
    Replace: string;
    /** (true)全部取代 (false)只取代關鍵字 */
    ReplaceAll: boolean;

    /** 關鍵字的索引位移，用於 capture 帶有非關鍵字時，跳脫判斷 */
    private Offset: number;

    /**
     * 建構關鍵字樣板
     * @param keyword 關鍵字
     * @param search 搜尋關鍵字的 Regex
     * @param replace 欲取代的樣式
     * @param replaceAll 是否全部取代
     */
    constructor(keyword: string, search: RegExp, replace: string, replaceAll: boolean, offset?: number) {
        this.Keyword = keyword;
        this.Search = search;
        this.Replace = replace;
        this.ReplaceAll = replaceAll;
        this.Offset = offset ? offset : 0;
    }

    /**
     * 解析是否需要針對關鍵字進行排版
     * @param editColl 欲儲存所有文字變更的集合
     * @param editRange 已處理過的位置
     * @param line 當前的文字行
     * @param commentIndex 註解的位置
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ) {
        /* 輪詢該行裡面的所有關鍵字 */
        let match: RegExpExecArray | null;
        while ((match = this.Search.exec(line.text))) {
            /* 若關鍵字在註解後面，直接往下一個繼續。此處是因為懶得用大 if 排版，所以才用 continue 😆 */
            if (commentIndex > -1 && commentIndex < match.index) {
                continue;   //不能 break !! 請看 260 行左右的註解
            }
            /* 如果找到的東西跟要取代的是一樣的，那就往下一個關鍵字繼續吧 */
            const replace = this.ReplaceAll ? this.Replace : match[0].replace(this.Keyword, this.Replace);
            if (match[0] === replace) {
                continue;
            }
            /* 檢查是否已有處理過 */
            const index = match.index + this.Offset;
            const processed = editRange.some(range => range.InRange(index));
            /* 沒有處理過，進行處理並記錄，已處理就跳過吧~ */
            if (!processed) {
                /* 排版 */
                editColl.push(
                    new TextEdit(
                        new Range(
                            line.lineNumber,
                            match.index,
                            line.lineNumber,
                            match.index + match[0].length
                        ),
                        replace
                    )
                );
                /* 紀錄位置 */
                editRange.push(
                    new InLineRange(
                        match.index,
                        match.index + match[0].length,
                        "k"
                    )
                );
            }
        }
    }
}

/**
 * 適用於 URScript 的文件排版供應器
 */
export class URScriptFormattingProvider
    implements DocumentRangeFormattingEditProvider {

    /** 用於括弧排版的樣板集合 */
    private BracketPatterns: BracketPattern[] = [
        new BracketPattern("(", ")"),
        new BracketPattern("[", "]")
    ];

    /** 用於符號排版的樣板集合
     * 請注意，此集合帶有「順序性」，回傳第一個符合者
     */
    private SignPatterns: SignPattern[] = [
        new SignPattern("==", "=="),
        new SignPattern(">=", ">="),
        new SignPattern("<=", "<="),
        new SignPattern("=>", "=>"),
        new SignPattern("=<", "=<"),
        new SignPattern("!=", "!="),
        new SignPattern(">", ">"),
        new SignPattern("<", "<"),
        new SignPattern("=", "="),
        new SignPattern("++", "\\+\\+"),
        new SignPattern("+", "\\+"),
        new SignPattern("--", "--"),
        new SignPattern("-", "-", [
            /(\(|\[|,|=|return)\s*-/g,
            /[eE]-\d+/g
        ]),
        new SignPattern("*", "\\*"),
        new SignPattern("/", "\\/", [
            /(http|https):\/\/\w+/g
        ])
    ];

    /** 關鍵字的排版 */
    private KeywordPatterns: KeywordPattern[] = [
        new KeywordPattern("if", /\s+if(\()/g, "if ", false),
        new KeywordPattern("elif", /\s+elif(\()/g, "elif ", false),
        new KeywordPattern("while", /\s+while(\()/g, "while ", false),
        new KeywordPattern("or", /(\s+|\b)or(\s+|\b)/g, " or ", true),
        new KeywordPattern("and", /(\s+|\b)and(\s+|\b)/g, " and ", true),
        new KeywordPattern("not", /(?<=\()\s*not(\s+|\b)/g, "not ", true),
        new KeywordPattern("not", /(?<==|or|and|not)\s*not\s*(?![^\(]*\))/g, " not ", true)
    ];

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
        /* 先用 Regex 檢查是否有指定的符號  */
        const match = line.text.match(/\b((?<!\w)end(?!\w))|(elif.*:)|(else:)/g);
        return match ? match.length > 0 : false;
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
                if (line.text.length === 0) {
                    continue;
                } else if (line.isEmptyOrWhitespace && line.text.length > 0) {
                    /* 裡面全空白，將之刪除 */
                    const edit = new TextEdit(
                        new Range(
                            new Position(lineNo, 0),
                            new Position(lineNo, line.text.length)
                        ),
                        ""
                    );
                    /* 加入集合 */
                    txtEdit.push(edit);
                    /* 往下一筆前進 */
                    continue;
                }
                /* 如果此行是註解，直接檢查前面縮排就好。若是內容則判斷之 */
                const isCmt = /^\s*(#|\$).*/.test(line.text);
                let brkStt = 0;
                if (!isCmt) {
                    /* 檢查是否有註解，如果有則取得其位置 */
                    const commentIndex = line.text.indexOf("#");
                    /* 紀錄當前已改動的部分，避免重複排版 */
                    const editRange: InLineRange[] = [];
                    /* 輪詢括弧樣板 */
                    this.BracketPatterns.forEach(
                        pat => brkStt |= pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* 輪詢符號樣板 */
                    this.SignPatterns.forEach(
                        pat => pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* 輪詢關鍵字樣板 */
                    this.KeywordPatterns.forEach(
                        pat => pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* 優先檢查是否是 end，因 end 也要往前減少縮排 */
                    if ((brkStt & 0x02) === 0x02 || this.needDecreaseIndent(line)) {
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
                if (
                    !isCmt &&
                    ((brkStt & 0x01) === 0x01 || this.needIncreaseIndent(line))
                ) {
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
            /* 檢查是否有註解，如果有則取得其位置 */
            const commentIndex = line.text.indexOf("#");
            /* 紀錄當前已改動的部分，避免重複排版 */
            const editRange: InLineRange[] = [];
            /* 輪詢括弧樣板 */
            this.BracketPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
            );
            /* 輪詢符號樣板 */
            this.SignPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
            );
            /* 輪詢關鍵字樣板 */
            this.KeywordPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
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
