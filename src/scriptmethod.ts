//for Documentation use
import { MarkdownString } from 'vscode';
//loading script functions that made by JSON
//import funcs from './functions.json';
import motionFunctions from './motionFunctions.json';
import internalsFunctions from './internalsFunctions.json';
import urmathFunctions from './urmathFunctions.json';
import interfacesFunctions from './interfacesFunctions.json';
import URG6Functions from './URG6Functions.json';
import ioconfigurationFunctions from './ioconfigurationFunctions.json';
import worldModelFunctinos from './worldModelFunctions.json'
import nodocFunctions from './nodocFunctions.json';
//check string is empty or null
import { isBlank } from './utilities/checkString.js';

/**
 * Variable types of URScript
 */
export enum Types {
    /**
     * none/null
     */
    None = 0x00,
    /**
     * boolean. `true` or `false`
     */
    Bool = 0x01,
    /**
     * number. contains `Int` and `Float`
     */
    Number = 0x06,
    /**
     * integer. likes 0, 1, 2, ...
     */
    Int = 0x02,
    /**
     * float. likes 0.1, 2.3, 4.5, ...
     */
    Float = 0x04,
    /**
     * pose. [X, Y, Z, Rx, Ry, Rz]
     */
    Pose = 0x08,
    /**
     * numeric collection. likes `Int[]` and `Float[]`
     */
    Array = 0x10,
    /**
     * string
     */
    String = 0x12,
    /**
     * struct
     */
    Struct = 0x30, 
    /**
     * matrix
     */
    Matrix = 0x20     
}

/**
 * Convert `Types` to `string`
 * @param value the `Types` to convert
 * @returns responsed type string
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
        case Types.Struct: return 'struct';
        case Types.Matrix: return 'matrix';
        default: return 'void';
    }
}

/**
 * Convert `string` to `Types`
 * @param str the `string` to convert
 * @returns responsed types
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
            case 'struct': return Types.Struct;
            case 'matrix': return Types.Matrix;
            default: return Types.None;
        }
    } else {
        return Types.None;
    }
}

/**
 * Parameter detail of function
 */
export class MethodParameter {

    /** parameter name */
    Label: string;
    /** comment for this parameter */
    Comment: string;
    /** type of this parameter */
    Type: Types;
    /** default value */
    Default: string;
    /** Markdown string for Documentation. Based on `Label` and `Comment`
     */
    Documentation: MarkdownString;

    /**
     * construct for parameter
     * @param jsPara the json object from function.json to parsing
     */
    constructor(jsPara: {
        "Label": string,
        "Type": string,
        "Comment": string,
        "Default": string
    }) {
        /* assign values */
        this.Label = jsPara.Label;
        this.Comment = jsPara.Comment;
        this.Default = jsPara.Default;
        this.Type = str2Type(jsPara.Type);
        /* create markdown string */
        const docStr = `${type2Str(this.Type)} **${this.Label}**\n> ${this.Comment}`;
        this.Documentation = new MarkdownString(docStr);
    }

    /**
     * gets the string of this parameter
     */
    public getParaStr(): string {
        if (isBlank(this.Default)) {
            return `${type2Str(this.Type)} ${this.Label}`;
        } else {
            return `${type2Str(this.Type)} ${this.Label} = ${this.Default}`;
        }
    }

    /**
     * gets the string show on hover
     * @returns string to show
     */
    public getParaDocStr(): string {
        if (isBlank(this.Default)) {
            return `  - \`${this.Label}\` (*${type2Str(this.Type)}*)  \n    ${this.Comment}`;
        } else {
            return `  - \`${this.Label}\` (*${type2Str(this.Type)}*) = ${this.Default}  \n    ${this.Comment}`;
        }
    }
}

/**
 * The package of URScript
 */
export class ScriptMethod {

    /** method/API name */
    Name: string;
    /** comments for return */
    Return: string;
    /** return type */
    ReturnType: Types;
    /** (null)not deprecated (not empty)comments for deprecated */
    Deprecated: string;
    /** comments for this method/API */
    Comment: string;
    /** collection of parameters/signatures (in parentheses) */
    Parameters: MethodParameter[];
    /** markdown string for Documentation. based on return, comment and parameters */
    Documentation: MarkdownString;
    /** short tip for CompletionItem and Hover title. contains name, parameters/signatures and return */
    Label: string;

    /**
     * construct a new method/API from json object
     * @param jsMthd the json object from functions.json
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
        /* copy values */
        this.Name = jsMthd.Name;
        this.Return = jsMthd.Return;
        this.Deprecated = jsMthd.Deprecated;
        this.Comment = jsMthd.Comment;
        this.Parameters = jsMthd.Parameters.map(jsPara => new MethodParameter(jsPara));
        this.ReturnType = str2Type(jsMthd.ReturnType);
        /* combine Documentation */
        //use 'docStr' to store 'return' and 'deprecated' information
        const docStr: string[] = [];
        if (this.Parameters.length > 0) {
            let paraDetail = this.Parameters.map(para => para.getParaDocStr()).join("\n");
            docStr.push(`- ***Parameters***\n${paraDetail}`);
        }
        if (!isBlank(this.Return)) {
            docStr.push(`- ***Return***  \n  ${this.Return}`);
        }
        if (!isBlank(this.Deprecated)) {
            docStr.push(`- ***Deprecated***\n  > ${this.Deprecated}`);
        }
        //Documentation = comment + docStr ... if 'docStr' not empty
        if (docStr.length > 0) {
            this.Documentation = new MarkdownString(
                `${this.Comment}\n\n${docStr.join('\n\n')}`
            );
        } else {
            //Documentation = comment ... if 'docStr' is empty
            this.Documentation = new MarkdownString(this.Comment);
        }
        /* combine Label */
        //join signatures by ','
        let paraStr = this.Parameters.map(para => para.getParaStr()).join(", ");
        //label = name(signatures)
        this.Label = `${type2Str(this.ReturnType)} ${this.Name}(${paraStr})`;
    }
}

/**
 * load 'functions.json' and parsing to ScriptMethod objects
 */
export function createFunctions(): ScriptMethod[] {
    /* using 'map' to poll each json object and parse it */
    let functionList = motionFunctions.map(jsMthd => new ScriptMethod(jsMthd));
    functionList = functionList.concat(internalsFunctions.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(urmathFunctions.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(interfacesFunctions.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(ioconfigurationFunctions.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(URG6Functions.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(worldModelFunctinos.map(jsMthd => new ScriptMethod(jsMthd)));
    functionList = functionList.concat(nodocFunctions.map(jsMthd => new ScriptMethod(jsMthd)));
    return functionList;
}