import {
    CompletionItem,
    CompletionItemKind,
    DocumentSymbol,
    Hover,
    Location,
    MarkdownString,
    ParameterInformation,
    Position,
    Range,
    SignatureHelp,
    SignatureInformation,
    SnippetString,
    SymbolKind,
    TextDocument,
    Uri,
    WorkspaceFolder
} from 'vscode';
//reading file (FileStream)
import * as fs from 'fs';
//get each line in file
import { ReadLinesSync } from './utilities/readLines';
//check string whether empty or null
import { isBlank } from './utilities/checkString';
//tools for Script
import { ScriptMethod, type2Str, str2Type } from './scriptmethod';
//parsing for file path
import * as path from 'path';

/**
  * The regex pattern to get variable/method name
 */
const namePat = /(\b(?<=(def|thread)\s+).*(?=\())|(\b(?<=global\s+).+(?==))|(\b(?<=global\s+).+\b)/;
/**
 * The regex pattern to get parameters that included in parentheses '(' and ')'
 */
const paramPat = /\((.*?)\)/;
/**
 * The maximum count to record each line parsed in the past
 */
const maxOldLineCount = 20;
/**
  * Ignore directory when searching files
 */
const ignoreDir: string[] = [ ".git", ".vscode" ];
/**
  * The file extension to search
 */
const tarExt: string[] = [ ".variables", ".script", ".urscript" ];

/**
 * Parsing &#64;param comments and convert to MethdParameter object
 * @param line the line to parsing
 * @param target the method or variable line declared
 */
function parseDocParam(line: string, target: string) {
    /* split by space */
    const splitted = line
        .replace("@param", "")
        .trim()
        .split(" ");
    /* 1st is the name of param */
    const first = splitted.shift();
    const label = first ? first : "";
    /* 2nd is the type of param */
    const typeStr = splitted.shift();
    const type = str2Type(typeStr);
    /* comments are after 3rd. Recombine to one line string */
    const comment = splitted.join(" ");
    /* check there contains default value */
    const defReg = target.match(`(?<=\\b${label}\\s*=)([^,)]+)`);
    let defStr = "";
    if (defReg) {
        defStr = defReg[0].trim();
    }
    return {
        "Label": label,
        "Type": type2Str(type),
        "Comment": comment,
        "Default": defStr
    };
}

/**
 * Parsing &#64;returns comments and convert to Return object
 * @param line the line to parsing
 */
function parseDocReturn(line?: string) {
    if (line) {
        /* split by space */
        const splitted = line
            .replace("@returns", "")
            .trim()
            .split(" ");
        /* 1st is the type of return */
        const type = str2Type(splitted.shift());
        /* comments are after 2nd. Recombine to one line string */
        const comment = splitted.join(" ");
        return {
            "ReturnType": type2Str(type),
            "Return": comment
        };
    }
}

/**
  * Searching UrDoc in line collection
 * @param lines the collection to search
 * @param target the method or variable name to search
 * @param name the name of variable/method to search
 */
function findDoc(name: string, target: string, lines?: string[]): ScriptMethod | undefined {
    /* ensure 'lines' not null and last line is "###" */
    if (lines && lines[lines.length - 1] === "###") {
        /* search start "###" of UrDoc from collection end to start */
        let startIndex = -1;
        let endIndex = lines.length - 1;
        /* search start from 'len - 2'. because 'len - 1' already checked in L.105 */
        for (let idx = lines.length - 2; idx >= 0; idx--) {
            if (lines[idx] === "###") {
                startIndex = idx;
                break;
            }
        }
        /* get the block and convert to UrDoc if both "###" are found */
        if (startIndex > -1 && startIndex < endIndex) {
            /* Trim '#' and space. just keep useful information  */
            const doc = lines
                .slice(startIndex + 1, endIndex)
                .map(l => l.replace(/#/g, '').trim());
            /* search the lines which containts '@param' and convert to MethodParameter object */
            const params = doc
                .filter(l => l.startsWith("@param"))
                .map(l => parseDocParam(l, target));
            /* search '@returns' and convert to Return object */
            const returns = parseDocReturn(
                doc.find(l => l.startsWith("@returns"))
            );
            /* the parts without '@' are summary comment */
            const summary = doc
                .filter(l => !l.startsWith("@"))
                .join("  \n");
            /* combine to UrDoc object */
            const info = {
                "Name": name,
                "ReturnType": returns ? returns.ReturnType : "None",
                "Return": returns ? returns.Return : "",
                "Deprecated": "",
                "Comment": summary,
                "Parameters": params
            };
            /* create ScriptMethod object and return it */
            return new ScriptMethod(info);
        }
    }
}

/**
 * Convert RegExpExecArray to CompletionItems
 * @param matchResult the regex match results
 * @param cmpItems the collection to store
 * @param oldLines temporary past lines
 */
function parseCmpItem(matchResult: RegExpExecArray | null, cmpItems: CompletionItem[], oldLines?: string[]) {
    /* exit if nothing matched */
    if (!matchResult || matchResult.length <= 0) {
        return;
    }
    /* convert result string to CompletionItem */
    matchResult.forEach(
        value => {
            if (value) {
                /* get method name */
                const nameReg = namePat.exec(value);
                /* convert it if successfully. Otherwise, just exit */
                if (nameReg) {
                    /* remove spaces and invisible char */
                    const name = nameReg[0].trim();
                    /* it may repeat... so just add at first time searched */
                    if (!cmpItems.some(cmp => cmp.label === name)) {
                        /* create CompletionItem and assign the keys which can let CompletionItem done(auto fill) */
                        const cmpItem = new CompletionItem(name);
                        cmpItem.commitCharacters = ["\t", " ", "\n"];
                        /*
                            search UrDoc in past lines. it should be like ...

                            ###
                            # get digital input
                            # @param n number the input to read
                            # @returns bool input level
                            ###
                        */
                        const doc = findDoc(name, value, oldLines);
                        /* add documentation to show on tooltip window if UrDoc found */
                        if (doc) {
                            cmpItem.documentation = doc.Documentation;
                        }
                        /* add types on tooltip window */
                        if (/global/.test(value)) {         //global show as variable
                            cmpItem.kind = CompletionItemKind.Variable;
                            cmpItem.insertText = name;
                            cmpItem.detail = `global ${name}`;
                        } else if (/thread/.test(value)) {  //thread show as variable
                            cmpItem.kind = CompletionItemKind.Variable;
                            cmpItem.insertText = `${name}()`;
                            cmpItem.detail = `thread ${name}`;
                        } else {    //method show as function
                            cmpItem.kind = CompletionItemKind.Function;
                            /* using UrDoc to snippet action if UrDoc found. parse this line otherwise */
                            if (doc) {
                                cmpItem.detail = doc.Label;
                                cmpItem.insertText = new SnippetString(doc.Name);
                                cmpItem.commitCharacters.push("("); //user can press '(' to let CompletionItem done (auto fill)
                            } else {
                                /* get content in parenthneses */
                                const paramReg = paramPat.exec(value);
                                /* parse if found. Otherwise, just show the name of method */
                                if (paramReg && paramReg.length > 1 && !isBlank(paramReg[1])) {
                                    /* split by ',' */
                                    const param = paramReg[1].split(",").map(p => p.trim());
                                    /* re-format the line. normalize the spaces */
                                    cmpItem.detail = `${name}(${param.join(", ")})`;
                                    /* calculate $1~$n for snippet. $0 as end of snippet location. $1 ~ $n will be changed if user press '↑', '↓' or ',' to show each parameter  */
                                    let signIdx = 1;
                                    const sign = param.map(p => `\${${signIdx++}:${p}}`);
                                    /* combine it */
                                    cmpItem.insertText = new SnippetString(`${name}(${sign.join(", ")})$0`);
                                } else {
                                    cmpItem.detail = `${name}`;
                                    cmpItem.insertText = new SnippetString(`${name}()$0`);
                                }
                            }
                        }
                        /* add to collection */
                        cmpItems.push(cmpItem);
                    }
                }
            }
        }
    );
}

/**
 * Convert RegExpExecArray to Hover
 * @param matchResult the regex match results
 * @param oldLines temporary past lines
 */
function parseHover(matchResult: RegExpExecArray | null, oldLines?: string[]): Hover | undefined {
    /* exit if nothing matched */
    if (!matchResult || matchResult.length <= 0) {
        return;
    }
    /* make a temporary */
    const step = matchResult[0];
    /* get method name */
    const nameReg = namePat.exec(step);
    /* create Hover if name was found. return null otherwise */
    if (nameReg) {
        /* trim spaces and invisible chars */
        const name = nameReg[0].trim();
        /* initialize a new collection to store convert result */
        const items: (MarkdownString | { language: string, value: string })[] = [];
        /*
            search UrDoc in past lines. it should be like ...

            ###
            # get digital input
            # @param n number the input to read
            # @returns bool input level
            ###
         */
        const doc = findDoc(name, step, oldLines);
        /* first line. show type and name */
        if (/global/.test(step)) {
            items.push(
                {
                    language: "urscript",
                    value: `global ${name}`
                }
            );
        } else if (/thread/.test(step)) {
            items.push(
                {
                    language: "urscript",
                    value: `thread  ${name}`
                }
            );
        } else {
            /* add directly if UrDoc found. otherwise, parse this line */
            if (doc) {
                items.push(
                    {
                        language: "urscript",
                        value: doc.Label
                    }
                );
            } else {
                /* add a notification that function was made by user */
                items.push(new MarkdownString("*user function*"));
                /* get content in parentheses */
                const paramReg = paramPat.exec(step);
                /* list if found. otherwise, just show the name */
                if (paramReg && paramReg.length > 1) {
                    /* split and trim to avoid invisible chars */
                    const param = paramReg[1].split(",").map(p => p.trim());
                    items.push(new MarkdownString(`${name}(${param.join(", ")})`));
                } else {
                    items.push(new MarkdownString(`${name}()`));
                }
            }
        }
        /* add documentation if UrDoc found */
        if (doc) {
            items.push(doc.Documentation);
        }
        /* create a new Hover and return it */
        return new Hover(items);
    }
}

/**
 * Convert RegExpExecArray to SignatureHelp
 * @param matchResult the regex match results
 * @param oldLines temporary past lines
 */
function parseSignature(matchResult: RegExpExecArray | null, oldLines?: string[]): SignatureHelp | undefined {
    /* exit if nothing matched */
    if (!matchResult || matchResult.length <= 0) {
        return;
    }
    /* make a temporary  */
    const step = matchResult[0];
    /* get method name */
    const nameReg = namePat.exec(step);
    /* create a SignatureHelp if found. return null otherwise */
    if (nameReg) {
        /* trim spaces and invisible chars */
        const name = nameReg[0].trim();
        /*
            search UrDoc in past lines. it should be like ...

            ###
            # get digital input
            # @param n number the input to read
            # @returns bool input level
            ###
         */
        const doc = findDoc(name, step, oldLines);
        /* parse UrDoc to SignatureHelp if found. Otherwise, return null */
        if (doc) {
            /* create a new information */
            const sigInfo = new SignatureInformation(doc.Label);
            /* convert UrDoc @param parts to information */
            const sigPara = doc.Parameters.map(
                para => {
                    let paraInfo = new ParameterInformation(para.Label);
                    paraInfo.documentation = para.Documentation;
                    return paraInfo;
                }
            );
            sigInfo.parameters = sigPara;
            /* create a help and assign values */
            const sigHelp = new SignatureHelp();
            sigHelp.activeParameter = 0;
            sigHelp.activeSignature = 0;
            sigHelp.signatures = [sigInfo];
            /* return it */
            return sigHelp;
        }
    }
}

/**
 * Store the files' path and name that mapped with file extension
 */
class ExtensionDictionary {
    [ext: string]: {filePath: string, fileName: string}[];
}

/**
 * get all files in directory
 * @param dir the directory to search
 * @param ignoreDir ignore directory
 * @param tarExt file ext to search
 * @param files store found files
 */
function getAllFiles(dir: string, ignoreDir: string[], tarExt: string[], files: ExtensionDictionary) {
    /* search all files in directory */
    const tmp = fs.readdirSync(dir);
    /* return null if no files */
    if (!tmp.length) {
        return null;
    }
    /* add to 'files' */
    tmp.forEach(
        obj => {
            /* tmp just get the filename without directory name. so re-combine to absolutely path */
            const rsPath = path.resolve(dir, obj);
            /* get the attributes of the path. to see file? directory? or others */
            const stt = fs.statSync(rsPath);
            /* recursive to get inner files if this path is a directory. check name and ext if this path is a file */
            if (stt && stt.isDirectory()) {
                /* ensure not in ignore list */
                if (!ignoreDir.find(d => obj === d)) {
                    getAllFiles(rsPath, ignoreDir, tarExt, files);
                }
            } else {
                /* get extension name of file */
                const ext = path.extname(obj);
                /* record this file if 'tarExt' contains 'ext' */
                if (tarExt.find(o => o === ext)) {
                    /* add to collection */
                    if (!files[ext]) {
                        /* first time searched. create new one */
                        files[ext] = [ {filePath: rsPath, fileName: obj} ];
                    } else {
                        /* not first time. just push to end */
                        files[ext].push({filePath: rsPath, fileName: obj});
                    }
                }
            }
        }
    );
}

/**
 * search method or variable with specific keyword in current editor and convert to CompletionItem
 * @param document the text of current editor
 * @param keyword current user pressed keyword
 * @param cmpItems the collection to store
 */
export function getCompletionItemsFromDocument(document: TextDocument, keyword: string, cmpItems: CompletionItem[]) {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "ig");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* poll each line from up to down */
    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        /* get one line */
        const line = document.lineAt(lineNo);
        /* trim spaces and invisible chars */
        const cur = line.text.trim();
        /* trying to get keyword parts */
        const match = mthdPat.exec(cur);
        /* parse regex result. add to 'cmpItems' if found */
        parseCmpItem(match, cmpItems, oldLines);
        /* if past line more than maximum count, drop one */
        if (oldLines.length > maxOldLineCount) {
            oldLines.shift();
        }
        /* push to end of collection */
        oldLines.push(cur);
    }
}

/**
 * search method or variable with specific keyword in file and convert to CompletionItem
 * @param fileName the file path to search. must be absolutely path.
 * @param keyword current user pressed keyword
 * @param cmpItems the collection to store
 */
export function getCompletionItemsFromFile(fileName: fs.PathLike, keyword: string, cmpItems: CompletionItem[]) {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`\\b(def|thread|global)\\s+${keyword}.*(\\(.*\\):)*`, "ig");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(fileName);
    /* poll each line in file */
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* trying to get keyword parts */
            const match = mthdPat.exec(cur);
            /* parse regex result. add to 'cmpItems' if found */
            parseCmpItem(match, cmpItems, oldLines);
            /* if past line more than maximum count, drop one */
            if (oldLines.length > maxOldLineCount) {
                oldLines.shift();
            }
            /* push to end of collection */
            oldLines.push(cur);
        }
    }
}

/**
 * search variable with specific keyword in .variable file and convert to CompletionItem
 * @param filePath the file path to search. must be absolutely path.
 * @param fileName the file name to search. just '*.variable'
 * @param keyword current user pressed keyword
 * @param cmpItems the collection to store
 */
function getCompletionItemsFromVariables(filePath: fs.PathLike, fileName: fs.PathLike, keyword: string, cmpItems: CompletionItem[]) {
    /* create new regex to search keyword */
    const namePat = new RegExp(`^${keyword}.*(?==)`, "ig");
    const valuePat = /(?<==)\s*.+/g;
    /* create match results */
    let nameMatch: RegExpExecArray | null;
    let valueMatch: RegExpExecArray | null;
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(filePath);
    /* poll each line in file */
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* search keyword parts with regex */
            while ((nameMatch = namePat.exec(cur))) {
                /* get the interest block and convert it */
                while ((valueMatch = valuePat.exec(cur))) {
                    /* create new item and assign values */
                    const cmpItem = new CompletionItem(nameMatch[0], CompletionItemKind.Variable);
                    cmpItem.commitCharacters = ["\t", " ", "\n"];
                    cmpItem.insertText = nameMatch[0];
                    cmpItem.detail = nameMatch[0];
                    cmpItem.documentation = new MarkdownString(
                        `*${fileName}*\n\n${nameMatch[0]} = \`${valueMatch[0]}\``
                    );
                    /* add to end of collection */
                    cmpItems.push(cmpItem);
                }
            }
        }
    }
    
}

/**
 * search method or variable with specific keyword in workspace (vscode was opened directory) and convert to CompletionItem
 * @param workspace the workspace folder to search
 * @param keyword current user pressed keyword
 * @param cmpItems the collection to store
 * @param explored explored(ignore) file name. bacause current editor was searched.
 */
export function getCompletionItemsFromWorkspace(workspace: WorkspaceFolder, keyword: string, cmpItems: CompletionItem[], explored: string) {
    /* get all files in workspace */
    const files: ExtensionDictionary = new ExtensionDictionary();
    getAllFiles(workspace.uri.fsPath, ignoreDir, tarExt, files);
    /* parse .script files */
    if (files[".script"] && files[".script"].length > 0) {
        files[".script"].forEach(
            file => getCompletionItemsFromFile(file.filePath, keyword, cmpItems)
        );
    }
    /* parse .variable files */
    if (files[".variables"] && files[".variables"].length > 0) {
        files[".variables"].forEach(
            file => getCompletionItemsFromVariables(file.filePath, file.fileName, keyword, cmpItems)
        );
    }
    /* parse .urscript files */
    if (files[".urscript"] && files[".urscript"].length > 0) {
        files[".urscript"].forEach(
            file => getCompletionItemsFromFile(file.filePath, keyword, cmpItems)
        );
    }
}

/**
 * search method or variable with specific keyword in current editor and convert to Hover
 * @param document the text of current editor
 * @param keyword current user mouse hovered keyword
 * @returns hover/tooltip. null when nothing matched
 */
export function getHoverFromDocument(document: TextDocument, keyword: string): Hover | undefined {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`(\\b(def|thread)\\s+${keyword}\\(.*\\):)|(\\bglobal\\s+${keyword}\\b)`, "g");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* poll each line in file */
    let hov: Hover | undefined;
    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        /* trim spaces and invisible chars */
        const cur = document.lineAt(lineNo).text.trim();
        /* trying to get interest block by regex */
        const match = mthdPat.exec(cur);
        /* convert to hover */
        hov = parseHover(match, oldLines);
        /* return if found */
        if (hov) {
            break;
        }
        /* if more than maximum, drop one */
        if (oldLines.length > maxOldLineCount) {
            oldLines.shift();
        }
        /* push to end of collection if not found */
        oldLines.push(cur);
    }
    /* return it */
    return hov;
}

/**
 * search method or variable with specific keyword in file and convert to Hover
 * @param fileName the file path to search. must be absolutely path.
 * @param keyword current user mouse hovered keyword
 * @returns hover/tooltip. null when nothing matched
 */
export function getHoverFromFile(fileName: string, keyword: string): Hover | undefined {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`(\\b(def|thread)\\s+${keyword}\\(.*\\):)|(\\bglobal\\s+${keyword}\\b)`, "g");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(fileName);
    /* poll each line in file */
    let hov: Hover | undefined;
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* trying to get interest block by regex */
            const match = mthdPat.exec(cur);
            /* convert to hover */
            hov = parseHover(match, oldLines);
            /* return if found */
            if (hov) {
                break;
            }
            /* if more than maximum, drop one */
            if (oldLines.length > maxOldLineCount) {
                oldLines.shift();
            }
            /* push to end of collection if not found */
            oldLines.push(cur);
        }
    }
    /* return it */
    return hov;
}

/**
 * search variable with specific keyword in .variable file and convert to Hover
 * @param filePath the file path to search. must be absolutely path.
 * @param fileName the file name to search. just '*.variable'
 * @param keyword current user mouse hovered keyword
 * @returns hover/tooltip. null when nothing matched
 */
function getHoverFromVariables(filePath: string, fileName: string, keyword: string): Hover | undefined {
    /* create new regex to search keyword */
    const namePat = new RegExp(`^${keyword}(?==)`, "g");
    const valuePat = /(?<==)\s*.+/g;
    /* create match results */
    let nameMatch: RegExpExecArray | null;
    let valueMatch: RegExpExecArray | null;
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(filePath);
    /* poll each line in file */
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* search keyword parts with regex */
            while ((nameMatch = namePat.exec(cur))) {
                /* get the interest block and convert it */
                while ((valueMatch = valuePat.exec(cur))) {
                    /* create new markdown and information collection for Hover construct */
                    const items: (MarkdownString | { language: string, value: string })[] = [
                        new MarkdownString(`*${fileName}*`),
                        {
                            language: "urscript",
                            value: `global ${nameMatch[0]} = ${valueMatch[0]}`
                        }
                    ];
                    /* return new Hover object */
                    return new Hover(items);
                }
            }
        }
    }
}

/**
 * search method or variable with specific keyword in workspace (vscode was opened directory) and convert to Hover
 * @param workspace the workspace folder to search
 * @param keyword current user mouse hovered keyword
 * @param explored explored(ignore) file name. bacause current editor was searched.
 * @returns hover/tooltip. null when nothing matched
 */
export function getHoverFromWorkspace(workspace: WorkspaceFolder, keyword: string, explored: string): Hover | undefined {
    /* get all files in workspace */
    const files: ExtensionDictionary = new ExtensionDictionary();
    getAllFiles(workspace.uri.fsPath, ignoreDir, tarExt, files);
    /* search .variable files */
    let hov: Hover | undefined;
    if (files[".variables"] && files[".variables"].length > 0) {
        /* poll files */
        for (const file of files[".variables"]) {
            /* search interest parts and convert to hover */
            hov = getHoverFromVariables(file.filePath, file.fileName, keyword);
            /* exit loop if found */
            if (hov) {
                break;
            }
        }
    }
    /* search .script files if .variable was not found */
    if (!hov && files[".script"] && files[".script"].length > 0) {
        /* poll files */
        for (const file of files[".script"]) {
            /* search interest parts and convert to hover */
            hov = getHoverFromFile(file.filePath, keyword);
            /* exit loop if found */
            if (hov) {
                break;
            }
        }
    }
    /* search .urscript files if .variable and .script were not found */
    if (!hov && files[".urscript"] && files[".urscript"].length > 0) {
        /* poll files */
        for (const file of files[".urscript"]) {
            /* search interest parts and convert to hover */
            hov = getHoverFromFile(file.filePath, keyword);
            /* exit loop if found */
            if (hov) {
                break;
            }
        }
    }
    /* return it */
    return hov;
}

/**
 * search and locate method or variable with specific keyword in current editor
 * @param document the text of current editor
 * @param keyword current user mouse hovered keyword
 * @returns the locations of keyword. it may be empty (len = 0) when nothing matched
 */
export function getLocationFromDocument(document: TextDocument, keyword: string): Location[] {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`(\\b(def|thread)\\s+${keyword}\\(.*\\):)|(\\bglobal\\s+${keyword}\\b)`, "g");
    const namePat = /\b(?!def|thread|global)\w+/gm;
    /* create collection for return */
    let locColl: Location[] = [];
    /* poll each line. until found keyword */
    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        /* search method by regex */
        const match = mthdPat.exec(document.lineAt(lineNo).text);
        if (match) {
            /* get method name by regex */
            const nameReg = namePat.exec(match[0]);
            /* create location if found */
            if (nameReg) {
                const loc = new Location(
                    document.uri,
                    new Position(
                        lineNo,
                        nameReg.index
                    )
                );
                locColl.push(loc);
            }
        }
    }
    return locColl;
}

/**
 * search and locate method or variable with specific keyword in file
 * @param fileName the file path to search. must be absolutely path.
 * @param keyword current user mouse hovered keyword
 * @param locColl the collection to store locations of keyword
 */
export function getLocationFromFile(fileName: fs.PathLike, keyword: string, locColl: Location[]) {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`(\\b(def|thread)\\s+${keyword}\\(.*\\):)|(\\bglobal\\s+${keyword}\\b)`, "g");
    const namePat = /\b(?!def|thread|global)\w+/gm;
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(fileName);
    /* poll each line. until found keyword */
    for (const ret of lineReader) {
        /* ensure not null */
        if (ret.line) {
            /* search method by regex */
            const match = mthdPat.exec(ret.line.toString());
            if (match) {
                /* get method name by regex */
                const nameReg = namePat.exec(match[0]);
                /* create instance if found */
                if (nameReg) {
                    const loc = new Location(
                        Uri.file(fileName.toString()),
                        new Position(
                            ret.lineNo,
                            nameReg.index
                        )
                    );
                    locColl.push(loc);
                }
            }
        }
    }
}

/**
 * search and locate variable with specific keyword in .variable file
 * @param filePath the file path to search. must be absolutely path.
 * @param fileName the file name to search. just '*.variable'
 * @param keyword current user mouse hovered keyword
 * @param locColl the collection to store locations of keyword
 */
export function getLocationFromVariables(filePath: fs.PathLike, fileName: fs.PathLike, keyword: string, locColl: Location[]) {
    /* create new regex to search keyword */
    const namePat = new RegExp(`^${keyword}(?==)`, "g");
    /* create match results */
    let nameMatch: RegExpExecArray | null;
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(filePath);
    /* poll each line in file */
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* search keyword parts with regex */
            while ((nameMatch = namePat.exec(cur))) {
                /* create new location and assign values */
                const loc = new Location(
                    Uri.file(filePath.toString()),
                    new Position(
                        pkg.lineNo,
                        nameMatch.index
                    )
                );
                locColl.push(loc);
            }
        }
    }
}

/**
 * search and locate method or variable with specific keyword in workspace (vscode was opened directory)
 * @param workspace the workspace folder to search
 * @param keyword current user mouse hovered keyword
 * @param explored explored(ignore) file name. bacause current editor was searched.
 * @returns the locations of keyword. it may be empty (len = 0) when nothing matched
 */
export function getLocationFromWorkspace(workspace: WorkspaceFolder, keyword: string, explored: string): Location[] {
    /* get all files in workspace */
    const files: ExtensionDictionary = new ExtensionDictionary();
    getAllFiles(workspace.uri.fsPath, ignoreDir, tarExt, files);
    /* initialize collection to store found location */
    let locColl: Location[] = [];
    /* get .variables files */
    if (files[".variables"] && files[".variables"].length > 0) {
        files[".variables"].forEach(
            file => {
                getLocationFromVariables(file.filePath, file.fileName, keyword, locColl);
            }
        );
    }
    /* get .script files */
    if (files[".script"] && files[".script"].length > 0) {
        files[".script"].forEach(
            file => {
                getLocationFromFile(file.filePath, keyword, locColl);
            }
        );
    }
    /* get .urscript files */
    if (files[".urscript"] && files[".urscript"].length > 0) {
        files[".urscript"].forEach(
            file => {
                getLocationFromFile(file.filePath, keyword, locColl);
            }
        );
    }
    /* return collection */
    return locColl;
}

/**
 * search method or variable with specific keyword in current editor and convert to as SignatureHelp
 * @param document the text of current editor
 * @param keyword current user mouse hovered keyword
 * @returns signature info. it may be null when nothing matched
 */
export function getSignatureFromDocument(document: TextDocument, keyword: string): SignatureHelp | undefined {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`\\bdef\\s+${keyword}\\(.*\\):`, "g");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* poll each line in file */
    let sigHelp: SignatureHelp | undefined;
    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        /* trim spaces and invisible chars */
        const cur = document.lineAt(lineNo).text.trim();
        /* trying to get interest block by regex */
        const match = mthdPat.exec(cur);
        /* parsing to signature obejct */
        sigHelp = parseSignature(match, oldLines);
        /* return it if found */
        if (sigHelp) {
            break;
        }
        /* if more than maximum limit, drop one */
        if (oldLines.length > maxOldLineCount) {
            oldLines.shift();
        }
        /* add to the end of collection */
        oldLines.push(cur);
    }
    /* return it */
    return sigHelp;
}

/**
 * search method or variable with specific keyword in file and convert to SignatureHelp
 * @param fileName the file path to search. must be absolutely path.
 * @param keyword current user mouse hovered keyword
 * @returns signature info. it may be null when nothing matched
 */
export function getSignatureFromFile(fileName: string, keyword: string): SignatureHelp | undefined {
    /* create new regex to search keyword */
    const mthdPat = new RegExp(`\\bdef\\s+${keyword}\\(.*\\):`, "g");
    /* create a new instance to store past lines */
    const oldLines: string[] = [];
    /* create a new reader to read each line */
    const lineReader = new ReadLinesSync(fileName);
    /* poll each line in file */
    let sigHelp: SignatureHelp | undefined;
    for (const pkg of lineReader) {
        /* ensure not null */
        if (pkg.line) {
            /* trim spaces and invisible chars */
            const cur = pkg.line.toString().trim();
            /* trying to get interest block by regex */
            const match = mthdPat.exec(cur);
            /* parsing to signature obejct */
            sigHelp = parseSignature(match, oldLines);
            /* return it if found */
            if (sigHelp) {
                break;
            }
            /* if more than maximum limit, drop one */
            if (oldLines.length > maxOldLineCount) {
                oldLines.shift();
            }
            /* add to the end of collection */
            oldLines.push(cur);
        }
    }
    /* return it */
    return sigHelp;
}

/**
 * search method or variable with specific keyword in workspace (vscode was opened directory) and convert to SignatureHelp
 * @param workspace the workspace folder to search
 * @param keyword current user mouse hovered keyword
 * @param explored explored(ignore) file name. bacause current editor was searched.
 * @returns signature info. it may be null when nothing matched
 */
export function getSignatureFromWorkspace(workspace: WorkspaceFolder, keyword: string, explored: string): SignatureHelp | undefined {
    /* get all files in workspace */
    const files: ExtensionDictionary = new ExtensionDictionary();
    const sigExt: string[] = [ ".script" ];
    getAllFiles(workspace.uri.fsPath, ignoreDir, sigExt, files);
    /* get .script files */
    let sigHelp: SignatureHelp | undefined;
    if (files[".script"] && files[".script"].length > 0) {
        for (const file of files[".script"]) {
            /* search keyword and convert to signature */
            sigHelp = getSignatureFromFile(file.filePath, keyword);
            /* return it if found */
            if (sigHelp) {
                break;
            }
        }
    }
    /* return it */
    return sigHelp;
}

/**
 * search all method in current editor and convert to DocumentSymbol
 * @param document the text of current editor
 * @returns symbol collection. it may be empty (len = 0) when nothing matched
 */
export function getSymbolsFromDocument(document: TextDocument): DocumentSymbol[] {
    /* create new regex to search keyword */
    const mthdPat = /^(?!=)(def|thread)\s+\w+\(.*\):/g;
    const namePat = /\b(?!def|thread)\w+(?=\()/gm;
    const paraPat = /\b(?!def|thread)\S+.+(?=:)/g;
    /* create match results */
    let mthdMatch: RegExpExecArray | null;
    let nameMatch: RegExpExecArray | null;
    let paraMatch: RegExpExecArray | null;
    /* create symbol results to store */
    let symColl: DocumentSymbol[] = [];
    /* poll each line */
    for (let lineNo = 0; lineNo < document.lineCount; lineNo++) {
        /* get current line and make temporary variable */
        const text = document.lineAt(lineNo).text;
        /* loop to get method name.
           it may cause fail if you not make regex be end of result (no next available)
           so I use 'while' here to ensure last time was nothing matched  */
        while ((mthdMatch = mthdPat.exec(text))) {
            /* get the name of method */
            while ((nameMatch = namePat.exec(mthdMatch[0]))) {
                /* get parameters in parentheses */
                while ((paraMatch = paraPat.exec(mthdMatch[0]))) {
                    /* found. create a new symbol and assign values */
                    const sym = new DocumentSymbol(
                        nameMatch[0],
                        paraMatch[0],
                        SymbolKind.Function,
                        new Range(
                            lineNo, nameMatch.index,
                            lineNo, nameMatch.index + nameMatch[0].length
                        ),
                        new Range(
                            lineNo, nameMatch.index,
                            lineNo, nameMatch.index + nameMatch[0].length
                        )
                    );
                    symColl.push(sym);
                }
            }
        }
    }
    return symColl;
}