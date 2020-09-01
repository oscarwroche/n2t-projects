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
        return classCompiler({ currentList: xmlTagList, currentOutput: [] });
    } else {
        throw Error("Not a class");
    }
};

type Compiler = (params: {
    currentList: string[];
    currentOutput: string[];
}) => { currentList: string[]; currentOutput: string[] };

type wordType = "keyword" | "identifier" | "symbol";

const wordCompilerGenerator = (type: wordType, word?: string) => (params: {
    currentList: string[];
    currentOutput: string[];
}) => {
    let { currentList, currentOutput } = params;
    const currentTagAndString = getTagAndString(currentList[0]);
    if (
        (!word && currentTagAndString.tag === type) ||
        (word &&
            currentTagAndString.tag === type &&
            currentTagAndString.string === word)
    ) {
        return {
            currentList: currentList.slice(0),
            currentOutput: currentOutput.concat(params.currentList[0]),
        };
    } else {
        throw new Error(
            `Error : identifier is ${word}, but current list is ${currentList}`
        );
    }
};

const emptyCompiler: Compiler = (x: any) => x;

const sequence = (compilers: Compiler[]): Compiler => {
    return (params: { currentList: string[]; currentOutput: string[] }) => {
        let { currentList, currentOutput } = params;
        for (const compiler of compilers) {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
            }));
        }
        return { currentList, currentOutput };
    };
};

const alternate = (compilers: Compiler[]): Compiler => {
    return (params: { currentList: string[]; currentOutput: string[] }) => {
        let { currentList, currentOutput } = params;
        for (const compiler of compilers) {
            try {
                ({ currentList, currentOutput } = compiler({
                    currentList,
                    currentOutput,
                }));
                return { currentList, currentOutput };
            } catch (e) {}
        }
        throw Error("None of the supplied compilers worked");
    };
};

const star = (compiler: Compiler): Compiler => {
    return (params: { currentList: string[]; currentOutput: string[] }) => {
        let { currentList, currentOutput } = params;
        try {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
            }));
            return star(compiler)({ currentList, currentOutput });
        } catch (e) {
            return { currentList, currentOutput };
        }
    };
};

const questionMark = (compiler: Compiler): Compiler => {
    return (params: { currentList: string[]; currentOutput: string[] }) => {
        let { currentList, currentOutput } = params;
        try {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
            }));
            return { currentList, currentOutput };
        } catch (e) {
            return { currentList, currentOutput };
        }
    };
};

const tabLine = (line: string) => `  ${line}`;

const taggedCompilerGenerator = (tag: string) => (
    compiler: Compiler
): Compiler => {
    return (params: { currentList: string[]; currentOutput: string[] }) => {
        let { currentList, currentOutput } = params;
        ({ currentList, currentOutput } = compiler({
            currentList,
            currentOutput,
        }));
        return {
            currentList,
            currentOutput: [`<${tag}>`]
                .concat(currentOutput)
                .map(tabLine)
                .concat(`</${tag}>`),
        };
    };
};

const typeCompiler = alternate([
    wordCompilerGenerator("keyword", "int"),
    wordCompilerGenerator("keyword", "char"),
    wordCompilerGenerator("keyword", "boolean"),
    wordCompilerGenerator("identifier"),
]);

const classVarDecCompiler: Compiler = taggedCompilerGenerator("classVarDec")(
    sequence([
        alternate([
            wordCompilerGenerator("keyword", "static"),
            wordCompilerGenerator("keyword", "field"),
        ]),
        typeCompiler,
        star(
            sequence([
                wordCompilerGenerator("symbol", ","),
                wordCompilerGenerator("identifier"),
            ])
        ),
        wordCompilerGenerator("symbol", ";"),
    ])
);

const parameterListCompiler = taggedCompilerGenerator("parameterList")(
    questionMark(
        sequence([
            sequence([typeCompiler, wordCompilerGenerator("identifier")]),
            star(
                sequence([
                    wordCompilerGenerator("symbol", ","),
                    typeCompiler,
                    wordCompilerGenerator("identifier"),
                ])
            ),
        ])
    )
);
const varDecCompiler = sequence([
    wordCompilerGenerator("keyword", "var"),
    typeCompiler,
    wordCompilerGenerator("identifier"),
    star(
        sequence([
            wordCompilerGenerator("symbol", ","),
            typeCompiler,
            wordCompilerGenerator("identifier"),
        ])
    ),
    wordCompilerGenerator("symbol", ";"),
]);

const expressionCompiler = emptyCompiler;

const letStatementCompiler = sequence([
    wordCompilerGenerator("keyword", "let"),
    wordCompilerGenerator("identifier"),
    questionMark(
        sequence([
            wordCompilerGenerator("symbol", "["),
            expressionCompiler,
            wordCompilerGenerator("symbol", "]"),
        ])
    ),
    wordCompilerGenerator("symbol", "="),
    expressionCompiler,
    wordCompilerGenerator("symbol", ";"),
]);

const ifStatementCompiler = sequence([
    wordCompilerGenerator("keyword", "if"),
    wordCompilerGenerator("symbol", "("),
    expressionCompiler,
    wordCompilerGenerator("symbol", ")"),
    wordCompilerGenerator("symbol", "{"),
    star(statementCompiler),
    wordCompilerGenerator("symbol", "}"),
    questionMark(
        sequence([
            wordCompilerGenerator("keyword", "else"),
            wordCompilerGenerator("symbol", "{"),
            star(statementCompiler),
            wordCompilerGenerator("symbol", "}"),
        ])
    ),
]);

const whileStatementCompiler = sequence([
    wordCompilerGenerator("keyword", "while"),
    wordCompilerGenerator("symbol", "("),
    expressionCompiler,
    wordCompilerGenerator("symbol", ")"),
    wordCompilerGenerator("symbol", "{"),
    star(statementCompiler),
    wordCompilerGenerator("symbol", "}"),
]);

const subroutineCallCompiler = emptyCompiler;

const doStatementCompiler = sequence([
    wordCompilerGenerator("keyword", "do"),
    subroutineCallCompiler,
    wordCompilerGenerator("symbol", ";"),
]);

const returnStatementCompiler = sequence([
    wordCompilerGenerator("keyword", "return"),
    questionMark(expressionCompiler),
    wordCompilerGenerator("symbol", ";"),
]);

const statementCompiler = alternate([
    letStatementCompiler,
    ifStatementCompiler,
    whileStatementCompiler,
    doStatementCompiler,
    returnStatementCompiler,
]);

const subroutineBodyCompiler = taggedCompilerGenerator("subroutineBody")(
    sequence([
        wordCompilerGenerator("symbol", "{"),
        star(varDecCompiler),
        star(statementCompiler),
        wordCompilerGenerator("symbol", "}"),
    ])
);

const subroutineDecCompiler: Compiler = taggedCompilerGenerator(
    "subroutineDec"
)(
    sequence([
        alternate([
            wordCompilerGenerator("keyword", "constructor"),
            wordCompilerGenerator("keyword", "function"),
            wordCompilerGenerator("keyword", "method"),
        ]),
        alternate(
            [wordCompilerGenerator("keyword", "void")].concat(typeCompiler)
        ),
        wordCompilerGenerator("identifier"),
        wordCompilerGenerator("symbol", "("),
        parameterListCompiler,
        wordCompilerGenerator("symbol", ")"),
        subroutineBodyCompiler,
    ])
);

const classCompiler: Compiler = sequence([
    wordCompilerGenerator("keyword", "class"),
    wordCompilerGenerator("identifier"),
    wordCompilerGenerator("symbol", "{"),
    star(classVarDecCompiler),
    star(subroutineDecCompiler),
    wordCompilerGenerator("symbol", "}"),
]);

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
