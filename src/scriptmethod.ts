//用於 Documentation 的 Markdown 字串
import { MarkdownString } from 'vscode';
//使用 TypeScript 的 JSON 解析功能來載入檔案
import funcs from './functions.json';
//檢查字串是否為空字串
import { isBlank } from './utilities/checkString.js';

/**
 * URScript 的變數類型
 */
export enum Types {
    /**
     * 空值
     */
    None = 0x00,
    /**
     * 布林值(Boolean)
     */
    Bool = 0x01,
    /**
     * 數值，包含整數(Integer)與浮點數(Float)
     */
    Number = 0x06,
    /**
     * 整數(Integer)
     */
    Int = 0x02,
    /**
     * 浮點數(Float)
     */
    Float = 0x04,
    /**
     * 手臂點位陣列 [X, Y, Z, Rx, Ry, Rz]
     */
    Pose = 0x08,
    /**
     * 數值陣列，包含整數陣列與浮點數陣列
     */
    Array = 0x10,
    /**
     * 字串
     */
    String = 0x12
}

/**
 * 取得 Types 對應的字串
 * @param value 欲判斷的類型
 */
export function type2Str(value: Types): string {
    switch (value) {
        case Types.Array: return 'array';
        case Types.Bool: return 'bool';
        case Types.Float: return 'float';
        case Types.Int: return 'int';
        case Types.Number: return 'number';
        case Types.Pose: return 'pose';
        case Types.String: return 'string';
        default: return 'void';
    }
}

/**
 * 將字串轉換為 Types
 * @param str 欲轉換的字串
 */
export function str2Type(str: string | undefined): Types {
    if (str) {
        const lowerName = str.toLowerCase();
        switch (lowerName) {
            case 'array': return Types.Array;
            case 'bool': return Types.Bool;
            case 'float': return Types.Float;
            case 'int': return Types.Int;
            case 'number': return Types.Number;
            case 'pose': return Types.Pose;
            case 'string': return Types.String;
            default: return Types.None;
        }
    } else {
        return Types.None;
    }
}

/**
 * 適用於 URScript 方法的簽章參數
 */
export class MethodParameter {

    /** 參數的名稱 */
    Label: string;
    /** 參數的使用說明 */
    Comment: string;
    /** 參數的類型 */
    Type: Types;
    /** 參數的預設數值 */
    Default: string;
    /** 已根據 Label 與 Comment 所調整而成，可用於文件內容的 Markdown 字串 */
    Documentation: MarkdownString;

    /**
     * 建構簽章參數
     * @param jsPara 由 JSON 檔案解析的 Parameter 物件
     */
    constructor(jsPara: {
        "Label": string,
        "Type": string,
        "Comment": string,
        "Default": string
    }) {
        /* 賦值 */
        this.Label = jsPara.Label;
        this.Comment = jsPara.Comment;
        this.Default = jsPara.Default;
        this.Type = str2Type(jsPara.Type);
        /* 組裝 Documentation */
        const docStr = `${type2Str(this.Type)} **${this.Label}**\n> ${this.Comment}`;
        this.Documentation = new MarkdownString(docStr);
    }

    /**
     * 取得此參數的對應字串，適用於引數字串
     */
    public getParaStr(): string {
        if (isBlank(this.Default)) {
            return `${type2Str(this.Type)} ${this.Label}`;
        } else {
            return `${type2Str(this.Type)} ${this.Label} = ${this.Default}`;
        }
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
    /** 回傳值的類型 */
    ReturnType: Types;
    /** (空字串)尚未被取代 (字串)已被取代的相關說明 */
    Deprecated: string;
    /** 方法的相關說明 */
    Comment: string;
    /** 簽章集合 */
    Parameters: MethodParameter[];
    /** 已根據 Return、Deprecated 與 Comment 所調整而成，可用於文件內容的 Markdown 字串 */
    Documentation: MarkdownString;
    /** 包含簽章、回傳值的標籤 */
    Label: string;

    /**
     * 建構 URScript 方法
     * @param jsMthd 由 JSON 檔案解析的 Method 物件
     */
    constructor(jsMthd: {
        "Name": string,
        "ReturnType": string,
        "Return": string,
        "Deprecated": string,
        "Comment": string,
        "Parameters": {
            "Label": string,
            "Type": string,
            "Comment": string,
            "Default": string
        }[]
    }) {
        /* 賦值 */
        this.Name = jsMthd.Name;
        this.Return = jsMthd.Return;
        this.Deprecated = jsMthd.Deprecated;
        this.Comment = jsMthd.Comment;
        this.Parameters = jsMthd.Parameters.map(jsPara => new MethodParameter(jsPara));
        this.ReturnType = str2Type(jsMthd.ReturnType);
        /* 組裝 Documentation */
        //先用 docStr 來儲存 Return 與 Deprecated
        const docStr: string[] = [];
        if (!isBlank(this.Return)) {
            docStr.push(`- *Return*\n  > ${this.Return}`);
        }
        if (!isBlank(this.Deprecated)) {
            docStr.push(`- *Deprecated*\n  > ${this.Deprecated}`);
        }
        //如果 docStr 有東西，則 Documentation = Comment + docStr
        if (docStr.length > 0) {
            this.Documentation = new MarkdownString(
                `${this.Comment}\n\n${docStr.join('\n\n')}`
            );
        } else {
            //docStr 沒東西，則直接 Documentation = Comment
            this.Documentation = new MarkdownString(this.Comment);
        }
        /* 組裝 Label */
        //將簽章內的標籤用逗號組裝起來
        let paraStr = this.Parameters.map(para => para.getParaStr()).join(", ");
        //標籤 = 名稱(簽章)
        this.Label = `${type2Str(this.ReturnType)} ${this.Name}(${paraStr})`;
    }
}

/**
 * 載入 functions.json 並取得其內容
 */
export function createFunctions(): ScriptMethod[] {
    /* 直接用 map 轉成 ScriptMethod */
    return funcs.map(jsMthd => new ScriptMethod(jsMthd));
}