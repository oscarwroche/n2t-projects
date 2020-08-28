import * as fs from "fs";

const main = () => {
    const fileStringsByFileNames = readTokenizedFiles();
    let translatedFileLines: string[] = [];
    for (const fileName in fileStringsByFileNames) {
        const outFileName = `${fileName.split(".").slice(0, -1)[0]}-TEST.xml`;
        const xmlTagList = fileStringsByFileNames[fileName].split("\r\n");
        const tokenizedLines = compileXmlTagList(xmlTagList);
        writeXmlFile(tokenizedLines.join("\r\n"), outFileName);
    }
    return "Done";
};

const TOKENS_STARTING_TAG = "<tokens>";
const TOKENS_ENDING_TAG = "</tokens>";

const readTokenizedFiles = () => {
    const cliArgs = process.argv.slice(2);
    const [fileOrDirName] = cliArgs;
    const stats = fs.statSync(fileOrDirName);
    if (stats.isFile()) {
        if (fileOrDirName.match(".xml")) {
            const fileString = fs.readFileSync(fileOrDirName, "utf8");
            return {
                [fileOrDirName]: fileString,
            };
        } else {
            throw new Error("File type is not .xml");
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

const compileXmlTagList = (xmlTagList: string[]): string[] => {
    if (xmlTagList !== []) {
        const { tag, string } = getTagAndString(xmlTagList[0]);
        if (isExpression(tag)) {
        } else if (isStatement(tag)) {
        }
        return [getTagAndString(xmlTagList[0]).string].concat(
            compileXmlTagList(xmlTagList.slice(1))
        );
    }
    return [];
};

type tag = {
    tagName: string;
    string: string;
};

const compile = (xmlTagList: string[]) => {
    if (classKeywords.indexOf(xmlTagList[0]) >= 0) {
        return compileClass(xmlTagList);
    } else {
        throw Error("Not a class");
    }
};

const compileClass = (xmlTagList: string[]) => {
    let output = ["<class>"];
    let { currentList, currentOutput } = compileIdentifier({
        currentList: xmlTagList,
        currentOutput: output,
    });
};

const compileIdentifier = (params: {
    currentList: string[];
    currentOutput: string[];
}) => {
    return {
        currentList: params.currentList.slice(0),
        currentOutput: params.currentOutput.concat(params.currentList[0]),
    };
};

const classKeywords = ["class"];
const classVarDecKeywords = ["static", "field"];

const compileLetStatement = (expression: string) => expression;
const compileExpression = (expression: string) => expression;

const isExpression = (expression: string) => expression;

const isStatement = (expression: string) => expression;

const getTagAndString = (
    taggedExpression: string
): {
    tag: string;
    string: string;
} => {
    const match = taggedExpression.match(/<(.+?)>(.+?)<\/.+*>/);
    if (match && match[1] && match[2]) {
        return {
            tag: match[1],
            string: match[2],
        };
    } else {
        throw new Error("Malformed tagged expression: " + taggedExpression);
    }
};

main();
