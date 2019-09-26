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
  /** 用於抓取字串內容的 Regex */
  private StringPattern = /\"(\d|\w|\s|[.,+\-\*/\(\)\[\]\{\}])*\"/g;

  /** 用於括弧排版的樣板集合 */
  private BracketPatterns: { Start: RegExp; End: RegExp }[] = [
    { Start: /\(/g, End: /\)/g },
    { Start: /\[/g, End: /\]/g }
  ];

  /** 用於符號排版，前後加上空白的樣板集合 */
  private SignPatterns: SignPattern[] = [
    new SignPattern("=", [
      new SignIncludeString(IncludePosition.Both, "="), // ==
      new SignIncludeString(IncludePosition.Both, ">"), // >=, =>
      new SignIncludeString(IncludePosition.Both, "<") // <=, =<
    ]),
    new SignPattern(">", [
      new SignIncludeString(IncludePosition.Both, ">"), // >>
      new SignIncludeString(IncludePosition.Both, "=") // >=, =>
    ]),
    new SignPattern("<", [
      new SignIncludeString(IncludePosition.Both, "<"), // <<
      new SignIncludeString(IncludePosition.Both, "=") // <=, =<
    ]),
    new SignPattern("+", [
      new SignIncludeString(IncludePosition.Both, "+", FormatAction.Ignore) //++
    ]),
    new SignPattern("-", [
      new SignIncludeString(IncludePosition.Both, "-", FormatAction.Ignore), //--
      new SignIncludeRegex(IncludePosition.After, /-\d+/, FormatAction.Ignore) //-123
    ]),
    new SignPattern("*", []),
    new SignPattern("/", [
      new SignIncludeRegex(IncludePosition.After, /\/\w+/, FormatAction.Ignore) // http://192
    ])
  ];

  /**
   * 檢查指定的位置是否在範圍中
   * @param range 可供判斷的範圍
   * @param value 欲判斷的位置
   */
  private inRange(
    range: { Start: number; End: number }[],
    value: number
  ): boolean {
    return range.some(p => p.Start < value && value < p.End);
  }

  /**
   * 搜尋括弧並在內容分隔補上空白
   * @param editColl 欲儲存所有文字變更的集合
   * @param line 當前的文字行
   * @param pattern 欲搜尋並處理的樣板
   * @returns (0)已完全閉鎖 (1)只有起始括弧 (2)只有結尾括弧
   */
  private formatBracket(
    editColl: TextEdit[],
    line: TextLine,
    pattern: { Start: RegExp; End: RegExp }[]
  ): number {
    /* 宣告儲存括號位置的集合 */
    const strCnt: { Start: number; End: number }[] = [];
    const start: number[] = [];
    const end: { Index: number; Matched: boolean }[] = [];
    /* 找出所有的字串 */
    let match: RegExpExecArray | null;
    while ((match = this.StringPattern.exec(line.text))) {
      strCnt.push({ Start: match.index, End: this.StringPattern.lastIndex });
    }
    /* 宣告配對組合 */
    const pair: { Start: number; End: number }[] = [];
    /* 依序抓出 Pattern */
    for (const pat of pattern) {
      while ((match = pat.Start.exec(line.text))) {
        if (!this.inRange(strCnt, match.index)) {
          start.unshift(match.index); //倒置，越後面的括號要先判斷
        }
      }
      while ((match = pat.End.exec(line.text))) {
        if (!this.inRange(strCnt, match.index)) {
          end.push({ Index: match.index, Matched: false });
        }
      }
      /* 每組 Pattern 結束後要先把相同的組合組在一起 */
      for (const idx of start) {
        /* 找出最近的結束括弧 */
        const tarIdx = end.findIndex(kvp => !kvp.Matched && idx < kvp.Index);
        if (tarIdx > -1) {
          /* 加入集合 */
          pair.push({ Start: idx + 1, End: end[tarIdx].Index });
          /* 標記為已經被配對，避免被重複搜尋 */
          end[tarIdx].Matched = true;
        }
      }
    }
    /* 如果有在大括弧裡面的，從 pair 中移除，避免重複排版 */
    const formatRange = pair.filter(
      p => !pair.some(o => o.Start < p.Start && p.End < o.End)
    );
    /* 依序將配對的內容拆開並加上空白 */
    if (formatRange.length > 0) {
      for (const p of formatRange) {
        /* 取出括弧中間的內容 */
        const subStr = line.text.substring(p.Start, p.End);
        /* 切割 */
        const split = subStr.split(",").map(str => str.trim());
        /* 組合成字串 */
        const param = split.join(", ");
        /* 如果內容不同再進行排版 */
        if (subStr !== param) {
          editColl.push(
            new TextEdit(
              new Range(line.lineNumber, p.Start, line.lineNumber, p.End),
              param
            )
          );
        }
      }
    }
    /* 根據狀態進行回傳 */
    if (start.length === end.length) {
      return 0; //全部都有閉鎖
    } else if (start.length > end.length) {
      return 1; //開始的比結束的多
    } else {
      return 2; //結束的比開始的多
    }
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
        if (cmtSign > -1 && cmtSign < index) {
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
          /* 輪詢括弧樣板 */
          brkStt = this.formatBracket(txtEdit, line, this.BracketPatterns);
          /* 輪詢符號樣板 */
          this.SignPatterns.forEach(pat => this.formatSign(txtEdit, line, pat));
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
      /* 輪詢括弧樣板 */
      this.formatBracket(edits, line, this.BracketPatterns);
      /* 輪詢符號樣板 */
      this.SignPatterns.forEach(pat => this.formatSign(edits, line, pat));
      /* 檢查右側是否有多餘的空白並刪除之 */
      this.trimRight(edits, line);
      /* 回傳 */
      return edits;
    } catch (error) {
      return [];
    }
  }
}
