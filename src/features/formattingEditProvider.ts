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
 * range in single line
 */
class InLineRange {

    /** start index (zero based) */
    public Start: number;
    /** end index (zero based) */
    public End: number;
    /** the string to add.  ("b")parenthese ("s")sign ("k")keyword */
    public AddBy: string;

    /**
     * construct a new range
     * @param start start index
     * @param end end index
     * @param by the string to add.  ("b")parenthese ("s")sign ("k")keyword
     */
    constructor(start: number, end: number, by: string) {
        this.Start = start;
        this.End = end;
        this.AddBy = by;
    }

    /**
     * check the index is in range? (start <= index <= end)
     * @param index the index to check
     */
    public InRange(index: number): boolean {
        return (this.Start <= index) && (index <= this.End);
    }
}

/**
 * the template of bracket
 */
class BracketPattern {

    /** the start sign of bracket */
    public StartSign: string;
    /** the end sign of bracket */
    public EndSign: string;

    /** the regex to find start bracket */
    private StartPattern: RegExp;
    /** the regex to find end bracket */
    private EndPattern: RegExp;
    /** the regex to search comma parts */
    private static CommaPattern = /,(?=([^\"]*\"[^\"]*\")*[^\"]*$)/g;

    /**
     * construct a template of bracket
     * @param start start bracket sign
     * @param end end bracket sign
     */
    constructor(start: string, end: string) {
        /* assign sign */
        this.StartSign = start;
        this.EndSign = end;
        /* create start and end regex */
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
     * format a text line
     * @param editColl the collection to store formatted result
     * @param editRange the collection of range that already dealt
     * @param line the text line to analyze
     * @param commentIndex the index of comments
     * @returns (0)both brackets are paired or no bracket found   (1)only start bracket found  (2)only end bracket found
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ): number {
        /* initial bracket state to (0) no bracket found */
        let bracketState = 0x00;
        /* create collections to store detail info.
           the idea of bracket search is find all start/end sign in this line
           and make a pair of latter start and former end. for example,
           
              ↓   ↓
           abc(def(ghi))
                      ↑↑

           start indexes : 3, 7
           end indexes : 11, 12
           pair : (7,11) (3,12)

           using end collection to ensure bracket are matched/paired state. */
        const pair: { Start: number, End: number }[] = [];
        const start: number[] = [];
        const end: { Index: number, Matched: boolean }[] = [];
        /* make a variable to store results of regex */
        let match: RegExpExecArray | null;
        /* search start bracket */
        while ((match = this.StartPattern.exec(line.text))) {
            /* add to result if start bracket index is before comment */
            if ((commentIndex < 0) || (match.index < commentIndex)) {
                start.unshift(match.index); //start bracket are reversed of collection. latter index is paired first.
            }
        }
        /* search end bracket */
        while ((match = this.EndPattern.exec(line.text))) {
            /* add to result if start bracket index is before comment */
            if ((commentIndex < 0) || (match.index < commentIndex)) {
                /* end bracket are normal direction. former index is paired first */
                end.push(
                    {
                        Index: match.index,
                        Matched: false
                    }
                );
            }
        }
        /* no bracket in this line if both start and end equals zero */
        if (start.length === 0 && end.length === 0) {
            return 0;
        } else if (start.length > 0 && end.length === 0) {
            return 1;   //only start bracket if one or more start brackets found but no end barcket
        } else if (start.length === 0 && end.length > 0) {
            return 2;   //only end bracket if one or more end brackets found but no start bracket
        } else if (start.length > end.length) {
            bracketState |= 0x01;   //start is more than end
        } else if (start.length < end.length) {
            bracketState |= 0x02;   //end is more than start
        }
        /* start pairing */
        for (const idx of start) {
            /* find end bracket that not matched and the index is bigger than start bracket  */
            const tarIdx = end.findIndex(kvp => !kvp.Matched && idx < kvp.Index);
            /* if end bracket found, add to result */
            if (tarIdx > -1) {
                /* add to result. the start index is the content next '(' */
                pair.push(
                    {
                        Start: idx + 1,
                        End: end[tarIdx].Index
                    }
                );
                /* mark as matched. avoid repeat */
                end[tarIdx].Matched = true;
            }
        }
        /* filter inner brackets. likes array index or parameters */
        const formatRange = pair.filter(
            p => !pair.some(o => (o.Start < p.Start) && (p.End < o.End))
        );
        /* separate content in brackets and add spaces between items */
        if (formatRange.length > 0) {
            for (const p of formatRange) {
                /* if the range already formatted, skip it */
                const repeated = editColl.some(e => (e.range.start.line === line.lineNumber)
                    && ((e.range.start.character <= p.Start) || (p.End <= e.range.end.character)));
                if (repeated) {
                    continue;
                }
                /* get the string in brackets */
                const subStr = line.text.substring(p.Start, p.End);
                /* split with comma.
                
                   according to regex will cache 'lastIndex' when 'g' was set.
                   it must let regex search to 'nothing matched' (lastIndex === 0)
                   so use 'while' here to ensure regex searched to the end of line and nothing matched.
                   
                   source: https://stackoverflow.com/questions/10229144/bug-with-regexp-in-javascript-when-do-global-search */

                const strColl: string[] = [];
                let lastIndex = 0;
                while ((match = BracketPattern.CommaPattern.exec(subStr))) {
                    strColl.push(subStr.substring(lastIndex, match.index).trim());
                    lastIndex = BracketPattern.CommaPattern.lastIndex;
                }
                /* add the content after lastIndex(comma) */
                strColl.push(subStr.substr(lastIndex).trim());
                /* join each part with a sigle comma and space */
                const param = strColl.join(", ");
                /* add to result collection if formatted result is different with origin string */
                if (subStr !== param) {
                    editColl.push(
                        new TextEdit(
                            new Range(line.lineNumber, p.Start, line.lineNumber, p.End),
                            param
                        )
                    );
                    /* store the range that formatted */
                    editRange.push(new InLineRange(p.Start, p.End, "b"));
                }
            }
        }
        /* return the bracket state */
        return bracketState;
    }
}

/**
 * the template of sign
 */
class SignPattern {

    /** the sign to format */
    public Sign: string;
    /** the regex to indicate do not format */
    public Excludes: RegExp[] | undefined;

    /** the regex to ensure sign was not in string */
    private NotStringPattern: RegExp;
    /** the ideal sign. E.g. with spaces, bracket and others */
    private Ideal: string;

    /**
     * construct a new template of sign
     * @param sign the sign to format
     * @param pattern the regex string of sign. E.g. sign '\' should replace as '\\'
     * @param exclude the regex to indicate do not format
     */
    constructor(sign: string, pattern: string, exclude?: RegExp[]) {
        this.Sign = sign;
        this.Ideal = ` ${sign} `;
        this.NotStringPattern = new RegExp(`(\\s*(${pattern})\\s*)(?=([^\\"]*\\"[^\\"]*\\")*[^\\"]*$)`, "g");
        this.Excludes = exclude;
    }

    /**
     * format a text line
     * @param editColl the collection to store formatted result
     * @param editRange the collection of range that already dealt
     * @param line the text line to analyze
     * @param commentIndex the index of comments
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ) {
        /* execute regex to get parts of sign that not in string */
        let index = 0;
        let match: RegExpExecArray | null;
        while ((match = this.NotStringPattern.exec(line.text))) {
            /* continue while loop when matched index was after comment */
            if (commentIndex > -1 && commentIndex < match.index) {
                continue;   //do not use break. let regex be no result matched to reset it.
            }
            /* check dealt? bracket is not conflict, so just check the range that dealt by SignPattern or KeywordPattern */
            index = match.index;
            const processed = editRange.some(r => r.AddBy !== "b" && r.InRange(index));
            if (processed) {
                /* dealt, continue while loop */
                continue;
            }
            /* check the match result is in excludes? */
            if (this.Excludes) {
                const exclude = this.Excludes.some(
                    ex => {
                        /* must check all line to ensure not in excludes */
                        let isExcluded = false;
                        let excludeResult: RegExpExecArray | null;
                        while ((excludeResult = ex.exec(line.text))) {
                            if (match &&
                                (excludeResult.index <= match.index) &&
                                (match.index <= (excludeResult.index + excludeResult[0].length))
                            ) {
                                isExcluded = true; //do not use break. let regex be no result matched to reset it.
                            }
                        }
                        /* return status */
                        return isExcluded;
                    }
                );
                /* go next match if excluded */
                if (exclude) {
                    continue;
                }
            }
            /* add to result collection if the matched sign was different with ideal */
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
            /* store the range that dealt */
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
 * the template of keyword
 */
class KeywordPattern {
    /** the keyword to format */
    Keyword: string;
    /** the regex to search keyword */
    Search: RegExp;
    /** the string to replace keyword */
    Replace: string;
    /** replace mode.  (true)replace all   (false)only keyword */
    ReplaceAll: boolean;

    /** the shift when keyword may have other characters after it. likes bracket, comma. */
    private Offset: number;

    /**
     * construct a new template of keyword
     * @param keyword the keyword to format
     * @param search the regex to search keyword
     * @param replace the string to replace keyword
     * @param replaceAll replace mode.  (true)replace all   (false)only keyword
     * @param offset index shift with keyword
     */
    constructor(keyword: string, search: RegExp, replace: string, replaceAll: boolean, offset?: number) {
        this.Keyword = keyword;
        this.Search = search;
        this.Replace = replace;
        this.ReplaceAll = replaceAll;
        this.Offset = offset ? offset : 0;
    }

    /**
     * format a text line
     * @param editColl the collection to store formatted result
     * @param editRange the collection of range that already dealt
     * @param line the text line to analyze
     * @param commentIndex the index of comments
     */
    public format(
        editColl: TextEdit[],
        editRange: InLineRange[],
        line: TextLine,
        commentIndex: number
    ) {
        /* search the keyword in current line */
        let match: RegExpExecArray | null;
        while ((match = this.Search.exec(line.text))) {
            /* continue while loop when matched index was after comment */
            if (commentIndex > -1 && commentIndex < match.index) {
                continue;   //do not use break. let regex be no result matched to reset it.
            }
            /* contitnue when matched result was same as replace */
            const replace = this.ReplaceAll ? this.Replace : match[0].replace(this.Keyword, this.Replace);
            if (match[0] === replace) {
                continue;
            }
            /* check dealt? */
            const index = match.index + this.Offset;
            const processed = editRange.some(range => range.InRange(index));
            /* add to collection when both BracketPattern and SignPattern are not deal */
            if (!processed) {
                /* add to result collection */
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
                /* store the range that dealt */
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
 * the DocumentRangeFormatting provider for URScript
 */
export class URScriptFormattingProvider
    implements DocumentRangeFormattingEditProvider {

    /** the collection of brackets to format */
    private BracketPatterns: BracketPattern[] = [
        new BracketPattern("(", ")"),
        new BracketPattern("[", "]")
    ];

    /** the collection of signs to format.
     * it is sequential! return first matched
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
            /(\(|\[|,|=|return|\*|\/)\s*-/g,
            /[eE]?-\d+/g
        ]),
        new SignPattern("*", "\\*"),
        new SignPattern("/", "\\/", [
            /(http|https):\/\/\w+/g
        ])
    ];

    /** the collection of keywords to format */
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
     * get indent count of line
     * @param line the line to count
     * @returns indent count (spaces)
     */
    private getIndent(line: TextLine): number {
        const match = line.text.match(/^\s*/g);
        return match ? match[0].length : 0;
    }

    /**
     * fix the line with correct indent count (spaces)
     * @param editColl the collection to store formatted result
     * @param line the line to fix
     * @param count the correct count of indent to fix
     */
    private setIndent(editColl: TextEdit[], line: TextLine, count: number) {
        const newText = `${" ".repeat(count)}${line.text.trim()}`;
        editColl.push(new TextEdit(line.range, newText));
    }

    /**
     * check necessary to add more indent count (applied on next line)
     * @param line the line to check
     * @returns (true)need add indent (false)not necessary
     */
    private needIncreaseIndent(line: TextLine): boolean {
        /* using regex to check language keyword */
        const match = line.text.match(/^\s*(def|thread|while|for|if|elif|else).*:(\s*|\s*#.*)$/g);
        return match ? match.length > 0 : false;
    }

    /**
     * check necessary to remove indent count (applied on next line)
     * @param line the line to check
     * @returns (true)need remove indent (false)not necessary
     */
    private needDecreaseIndent(line: TextLine): boolean {
        /* using regex to check language keyword */
        const match = line.text.match(/^\s*(end|(elif.+:)|else:)(\s*|\s*#.*)$/g);
        return match ? match.length > 0 : false;
    }

    /**
     * check useless spaces in the end of line, trim it!
     * @param editColl the collection to store formatted result
     * @param line the line to check
     */
    private trimRight(editColl: TextEdit[], line: TextLine) {
        if (/\s$/.test(line.text)) {
            editColl.push(new TextEdit(line.range, line.text.trimRight()));
        }
    }

    /**
     * provide a formatting of current editor
     * @param document current editor of vscode
     * @param range the range to format
     * @param options the formatting options from vscode (user)
     * @param token the token to indicate cancellation
     * @returns the collection of text, position and result that need to format
     */
    public async provideDocumentRangeFormattingEdits(
        document: TextDocument,
        range: Range,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        try {
            /* initial the collection of format range */
            const txtEdit: TextEdit[] = [];
            /* initial the indent start from zero */
            let indent = 0;
            /* poll each line in the editor range */
            for (let lineNo = range.start.line; lineNo <= range.end.line; lineNo++) {
                /* get the text of specific lineNo */
                const line = document.lineAt(lineNo);
                /* continue when empty line */
                if (line.text.length === 0) {
                    continue;
                } else if (line.isEmptyOrWhitespace && line.text.length > 0) {
                    /* trim this line if all characters in this line is spaces */
                    const edit = new TextEdit(
                        new Range(
                            new Position(lineNo, 0),
                            new Position(lineNo, line.text.length)
                        ),
                        ""
                    );
                    /* add to result collection */
                    txtEdit.push(edit);
                    /* go next line */
                    continue;
                }
                /* check all of this line is spaces and comment? */
                const isCmt = /^\s*(#|\$).*/.test(line.text);
                let brkStt = 0;
                if (!isCmt) {
                    /* get the lineIndex of comment '#' sign */
                    const commentIndex = line.text.indexOf("#");
                    /* initial the collection to store formatted range to avoid duplicated */
                    const editRange: InLineRange[] = [];
                    /* search the bracket parts that need format */
                    this.BracketPatterns.forEach(
                        pat => brkStt |= pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* search the sign parts that need format */
                    this.SignPatterns.forEach(
                        pat => pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* search the keyword parts that need format */
                    this.KeywordPatterns.forEach(
                        pat => pat.format(txtEdit, editRange, line, commentIndex)
                    );
                    /* check 'end bracket' first. because it need to remove indent for next line */
                    if ((brkStt & 0x02) === 0x02 || this.needDecreaseIndent(line)) {
                        indent = indent >= options.tabSize ? indent - options.tabSize : 0;
                    }
                }
                /* check indent is correct? */
                if (this.getIndent(line) !== indent) {
                    this.setIndent(txtEdit, line, indent);
                } else {
                    /* trim useless spaces in the end of line. the indent (start of this line) is checked on 'if' syntax */
                    this.trimRight(txtEdit, line);
                }
                /* add indent when block or method in this line */
                if (
                    !isCmt &&
                    ((brkStt & 0x01) === 0x01 || this.needIncreaseIndent(line))
                ) {
                    indent += options.tabSize;
                }
            }
            // txtEdit.forEach(
            //     v => {
            //         console.log(`range: '${v.range.start.line}(${v.range.start.character} to ${v.range.end.character})', text: '${v.newText}'`);
            //     }
            // );
            /* return the parts to format */
            return txtEdit;
        } catch (error) {
            return [];
        }
    }

    /**
     * provide a formatting of current typed line. usually triggered with 'enter'
     * @param document current editor of vscode
     * @param position cursor position
     * @param ch the last character before cursor position
     * @param options the formatting options from vscode (user)
     * @param token the token to indicate cancellation
     */
    public async provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        token: CancellationToken
    ): Promise<TextEdit[]> {
        try {
            /* initial the collection of format range */
            const edits: TextEdit[] = [];
            /* get the last typed line */
            const line =
                ch === "\n"
                    ? document.lineAt(position.line - 1)
                    : document.lineAt(position);
            /* return null when the line is fill with spaces */
            if (line.isEmptyOrWhitespace) {
                return [];
            }
            /* get the index of comment '#' sign */
            const commentIndex = line.text.indexOf("#");
            /* initial the collection of format range */
            const editRange: InLineRange[] = [];
            /* search the bracket parts that need format */
            this.BracketPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
            );
            /* search the sign parts that need format */
            this.SignPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
            );
            /* search the keyword parts that need format */
            this.KeywordPatterns.forEach(
                pat => pat.format(edits, editRange, line, commentIndex)
            );
            /* trim useless spaces in the end of line */
            this.trimRight(edits, line);
            /* return the parts that need format */
            return edits;
        } catch (error) {
            return [];
        }
    }
}
