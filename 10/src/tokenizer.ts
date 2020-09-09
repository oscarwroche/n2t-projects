import * as fs from "fs";

const main = () => {
    const fileStringsByFileNames = readJackFiles();
    for (const fileName in fileStringsByFileNames) {
        const outFileName = `${fileName.split(".").slice(0, -1)[0]}-TEST.xml`;
        let splitFileString = fileStringsByFileNames[fileName].split("\r\n");
        if (splitFileString.length === 1) {
            splitFileString = fileStringsByFileNames[fileName].split("\n");
        }
        let processedFileString = splitFileString
            .filter((line) => !isCommentLine(line) && !isBlankLine(line))
            .map((line) => line.replace(COMMENT_REGEX, ""))
            .join("")
            .replace(/\/\*\*.+?\*\//g, "");
        const tokenizedLines = [TOKENS_STARTING_TAG]
            .concat(tokenizeString(processedFileString))
            .concat([TOKENS_ENDING_TAG]);
        writeXmlFile(tokenizedLines.join("\r\n"), outFileName);
    }
    return "Done";
};

const TOKENS_STARTING_TAG = "<tokens>";
const TOKENS_ENDING_TAG = "</tokens>";

const readJackFiles = () => {
    const cliArgs = process.argv.slice(2);
    const [fileOrDirName] = cliArgs;
    const stats = fs.statSync(fileOrDirName);
    if (stats.isFile()) {
        if (fileOrDirName.match(".jack")) {
            const fileString = fs.readFileSync(fileOrDirName, "utf8");
            return {
                [fileOrDirName]: fileString,
            };
        } else {
            throw new Error("File type is not .vm");
        }
    } else {
        const inFileNames: string[] = [];
        const fileStringsByFileNames: { [fileName: string]: string } = {};
        fs.readdirSync(fileOrDirName, "utf8")
            .filter((fileName) => fileName.match(".jack"))
            .map((fileName) => {
                inFileNames.push(fileName);
                fileStringsByFileNames[fileName] = fs.readFileSync(
                    fileOrDirName + fileName,
                    "utf8"
                );
            });
        return fileStringsByFileNames;
    }
};

const writeXmlFile = (fileString: string, fileName: string) => {
    fs.writeFileSync(fileName, fileString, "utf8");
};

const KEYWORD_TOKENS = [
    "CLASS",
    "METHOD",
    "FUNCTION",
    "CONSTRUCTOR",
    "INT",
    "BOOLEAN",
    "CHAR",
    "VOID",
    "VAR",
    "STATIC",
    "FIELD",
    "LET",
    "DO",
    "IF",
    "ELSE",
    "WHILE",
    "RETURN",
    "TRUE",
    "FALSE",
    "NULL",
    "THIS",
];
const SYMBOL_TOKENS = [
    "{",
    "}",
    "(",
    ")",
    "[",
    "]",
    ".",
    ",",
    ";",
    "+",
    "-",
    "*",
    "/",
    "&",
    ",",
    "<",
    ">",
    "=",
    "~",
    "|",
];

const xmlSymbolsMap = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "&": "&amp;",
};

function isXmlSymbol(value: string): value is keyof typeof xmlSymbolsMap {
    return xmlSymbolsMap.hasOwnProperty(value);
}

const escapeSpecialChars = (input: string) => `\\${input}`;

const tokenRegexes = {
    keyword: new RegExp(`^(${KEYWORD_TOKENS.join("|")})`, "i"),
    symbol: new RegExp(
        `^(${SYMBOL_TOKENS.map(escapeSpecialChars).join("|")})`,
        "i"
    ),
    identifier: /^([A-Za-z_](?:[A-Za-z0-9_])*)/,
    integerConstant: /^([0-9]+)/,
    stringConstant: /(\".+?\")/,
};

const isValidTokenRegexName = (
    regexCandidate: string
): regexCandidate is keyof typeof tokenRegexes =>
    Object.keys(tokenRegexes).indexOf(regexCandidate) >= 0;

const tokenizeString = (fileString: string): string[] => {
    if (fileString !== "") {
        for (const tokenRegexName in tokenRegexes) {
            if (isValidTokenRegexName(tokenRegexName)) {
                const match = fileString.match(tokenRegexes[tokenRegexName]);
                if (match) {
                    let newFileString = removeWhiteSpace(
                        fileString.slice(match[0].length)
                    );
                    console.log(match[0]);
                    return [
                        `<${tokenRegexName}> ${
                            isXmlSymbol(match[0])
                                ? xmlSymbolsMap[match[0]]
                                : `${match[0]}`
                        } </${tokenRegexName}>`,
                    ].concat(tokenizeString(newFileString));
                }
            }
        }
        console.log("Invalid statement, stopped at : " + fileString);
        return [];
    }
    return [];
};

const removeWhiteSpace = (input: string): string => {
    if (input !== "") {
        let output = input;
        while (output[0].match(/\s/)) {
            output = output.slice(1);
        }
        return output ? output : "";
    }
    return "";
};

const COMMENT_LINE_REGEX = /^\s*?(?:\/\/)|(?:\/\*)[^\*]+/;
const COMMENT_REGEX = /\/\/.+/;

const isCommentLine = (line: string) => !!line.match(COMMENT_LINE_REGEX);
const isBlankLine = (line: string) => !!line.match(/^\s+$/);

main();
