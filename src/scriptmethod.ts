//用於 Documentation 的 Markdown 字串
import { MarkdownString } from 'vscode';
//使用 TypeScript 的 JSON 解析功能來載入檔案
import funcs from './functions.json';

/**
 * 適用於 URScript 方法的簽章參數
 */
export class MethodParameter {

    /** 參數的名稱 */
    Label: string;
    /** 參數的使用說明 */
    Comment: string;

    /**
     * 建構簽章參數
     * @param jsPara 由 JSON 檔案解析的 Parameter 物件
     */
    constructor(jsPara: {
        "Label": string,
        "Comment": string
    }) {
        this.Label = jsPara.Label;
        this.Comment = jsPara.Comment;
    }

}

/**
 * 適用於 URScript 的方法，包含名稱、說明、回傳值以及簽章
 */
export class ScriptMethod {

    /** 方法的名稱 */
    Name: string;
    /** 回傳值說明 */
    Return: string;
    /** (空字串)尚未被取代 (字串)已被取代的相關說明 */
    Deprecated: string;
    /** 方法的相關說明 */
    Comment: string;
    /** 簽章集合 */
    Parameters: MethodParameter[];
    /** 已根據 Return、Deprecated 與 Comment 所調整而成，可用於文件內容的 Markdown 字串 */
    Documentation: MarkdownString;

    /**
     * 建構 URScript 方法
     * @param jsMthd 由 JSON 檔案解析的 Method 物件
     */
    constructor(jsMthd: {
        "Name": string,
        "Return": string,
        "Deprecated": string,
        "Comment": string,
        "Parameters": {
            "Label": string,
            "Comment": string
        }[]
    }) {
        /* 賦值  */
        this.Name = jsMthd.Name;
        this.Return = jsMthd.Return;
        this.Deprecated = jsMthd.Deprecated;
        this.Comment = jsMthd.Comment;
        this.Parameters = jsMthd.Parameters.map(jsPara => new MethodParameter(jsPara));
        /* 組裝 Documentation */
        //先用 docStr 來組合 Return 與 Deprecated
        let docStr = "";
        if ((this.Return !== "") && (this.Deprecated !== "")) {
            docStr = `\r\n\r\n**Return**\r\n> ${this.Return}\r\n**Deprecated**\r\n> ${this.Deprecated}`;
        } else if (this.Return !== "") {
            docStr = `\r\n\r\n**Return**\r\n> ${this.Return}`;
        } else if (this.Deprecated !== "") {
            docStr = `\r\n\r\n**Deprecated**\r\n> ${this.Deprecated}`;
        }
        //如果 docStr 有東西，則 Documentation = Comment + docStr
        if (docStr !== "") {
            this.Documentation = new MarkdownString(this.Comment.concat(docStr));
        } else {
            //docStr 沒東西，則直接 Documentation = Comment
            this.Documentation = new MarkdownString(this.Comment);
        }
    }
}

/**
 * 載入 functions.json 並取得其內容
 */
export function createFunctions() : ScriptMethod[] {
    /* 直接用 map 轉成 ScriptMethod */
    return funcs.map(jsMthd => new ScriptMethod(jsMthd));
}