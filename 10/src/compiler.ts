import * as fs from "fs";

const main = () => {
    const fileStringsByFileNames = readTokenizedFiles();
    for (const fileName in fileStringsByFileNames) {
        const outFileName = `${
            fileName.split(".").slice(0, -1)[0]
        }-COMPILED-TEST.xml`;
        const xmlTagList = fileStringsByFileNames[fileName].split("\r\n");
        const compiledLines = compile(xmlTagList.slice(1, -1));
        writeXmlFile(compiledLines.join("\r\n"), outFileName);
    }
    return "Done";
};

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

const compile = (xmlTagList: string[]) =>
    classCompiler({ currentList: xmlTagList, currentOutput: [], tabSpace: "" })
        .currentOutput;

type Compiler = (params: {
    currentList: string[];
    currentOutput: string[];
    tabSpace?: string;
}) => { currentList: string[]; currentOutput: string[] };

type wordType =
    | "keyword"
    | "identifier"
    | "symbol"
    | "stringConstant"
    | "integerConstant";

function wordCompilerGenerator(type: wordType, word?: string) {
    return debug(`wordCompiler - type : ${type} - word: ${word}`)(
        (params: CompilerInput) => {
            let { currentList, currentOutput, tabSpace } = params;
            const currentTagAndString = getTagAndString(currentList[0]);
            if (
                (!word && currentTagAndString.tag === type) ||
                (word &&
                    currentTagAndString.tag === type &&
                    currentTagAndString.string === word)
            ) {
                return {
                    currentList: currentList.slice(1),
                    currentOutput: currentOutput.concat(
                        `${tabSpace}${currentList[0]}`
                    ),
                    tabSpace,
                };
            } else {
                throw new Error(
                    `Error : identifier is ${word}, but current list is ${currentList}`
                );
            }
        }
    );
}

function debugCompilerGenerator(debugString: string) {
    return function (params: CompilerInput) {
        console.log("DEBUG :", debugString);
        let { currentList, currentOutput, tabSpace } = params;
        console.log("DEBUG : next item in list is ", currentList[0]);
        return {
            currentList,
            currentOutput,
            tabSpace,
        };
    };
}

function sequence(compilers: Compiler[]): Compiler {
    return function (params: CompilerInput) {
        let { currentList, currentOutput, tabSpace } = params;
        for (const compiler of compilers) {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
                tabSpace,
            }));
        }
        return { currentList, currentOutput, tabSpace };
    };
}

function alternate(compilers: Compiler[]): Compiler {
    return function (params: CompilerInput) {
        let { currentList, currentOutput, tabSpace } = params;
        for (const compiler of compilers) {
            try {
                ({ currentList, currentOutput } = compiler({
                    currentList,
                    currentOutput,
                    tabSpace,
                }));
                return { currentList, currentOutput, tabSpace };
            } catch (e) {}
        }
        throw Error("None of the supplied compilers worked");
    };
}

function star(compiler: Compiler): Compiler {
    return function (params: CompilerInput) {
        let { currentList, currentOutput, tabSpace } = params;
        try {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
                tabSpace,
            }));
            return star(compiler)({ currentList, currentOutput, tabSpace });
        } catch (e) {
            return { currentList, currentOutput, tabSpace };
        }
    };
}

function questionMark(compiler: Compiler): Compiler {
    return function (params: CompilerInput) {
        let { currentList, currentOutput, tabSpace } = params;
        try {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
                tabSpace,
            }));
            return { currentList, currentOutput, tabSpace };
        } catch (e) {
            return { currentList, currentOutput, tabSpace };
        }
    };
}

type CompilerInput = {
    currentList: string[];
    currentOutput: string[];
    tabSpace?: string;
};

const tabLine = (line: string) => `  ${line}`;

const taggedCompilerGenerator = (tag: string) => (
    compiler: Compiler
): Compiler => {
    return function (params: CompilerInput) {
        let { currentList, currentOutput, tabSpace } = params;
        currentOutput = currentOutput.concat([`${tabSpace}<${tag}>`]);
        ({ currentList, currentOutput } = compiler({
            currentList,
            currentOutput,
            tabSpace: `  ${tabSpace}`,
        }));
        currentOutput = currentOutput.concat([`${tabSpace}</${tag}>`]);
        return {
            currentList,
            currentOutput,
        };
    };
};

const debug = function (debugString: string) {
    return function (f: Compiler) {
        return sequence([debugCompilerGenerator(debugString), f]);
    };
};

function unaryOpCompiler(params: CompilerInput) {
    return debug("unaryOpCompiler")(
        alternate(
            ["-", "~"].map((symbol: string) =>
                wordCompilerGenerator("symbol", symbol)
            )
        )
    )(params);
}

function termCompiler(params: CompilerInput) {
    return debug("termCompiler")(
        taggedCompilerGenerator("term")(
            alternate([
                wordCompilerGenerator("integerConstant"),
                wordCompilerGenerator("stringConstant"),
                alternate(
                    [
                        "true",
                        "false",
                        "null",
                        "this",
                    ].map((keywordConstant: string) =>
                        wordCompilerGenerator("keyword", keywordConstant)
                    )
                ),
                subroutineCallCompiler,
                sequence([
                    wordCompilerGenerator("identifier"),
                    wordCompilerGenerator("symbol", "["),
                    expressionCompiler,
                    wordCompilerGenerator("symbol", "]"),
                ]),
                wordCompilerGenerator("identifier"),
                sequence([
                    wordCompilerGenerator("symbol", "("),
                    expressionCompiler,
                    wordCompilerGenerator("symbol", ")"),
                ]),
                sequence([unaryOpCompiler, termCompiler]),
            ])
        )
    )(params);
}

function opCompiler(params: CompilerInput) {
    return debug("opCompiler")(
        alternate(
            [
                "+",
                "-",
                "*",
                "/",
                "&amp;",
                "|",
                "&lt;",
                "&gt;",
                "=",
            ].map((symbol: string) => wordCompilerGenerator("symbol", symbol))
        )
    )(params);
}

function expressionCompiler(params: CompilerInput) {
    return debug("expressionCompiler")(
        taggedCompilerGenerator("expression")(
            sequence([termCompiler, star(sequence([opCompiler, termCompiler]))])
        )
    )(params);
}

function typeCompiler(params: CompilerInput) {
    return debug("typeCompiler")(
        alternate([
            wordCompilerGenerator("keyword", "int"),
            wordCompilerGenerator("keyword", "char"),
            wordCompilerGenerator("keyword", "boolean"),
            wordCompilerGenerator("identifier"),
        ])
    )(params);
}

function classVarDecCompiler(params: CompilerInput) {
    return debug("classVarDecCompiler")(
        taggedCompilerGenerator("classVarDec")(
            sequence([
                alternate([
                    wordCompilerGenerator("keyword", "static"),
                    wordCompilerGenerator("keyword", "field"),
                ]),
                typeCompiler,
                wordCompilerGenerator("identifier"),
                star(
                    sequence([
                        wordCompilerGenerator("symbol", ","),
                        wordCompilerGenerator("identifier"),
                    ])
                ),
                wordCompilerGenerator("symbol", ";"),
            ])
        )
    )(params);
}

function parameterListCompiler(params: CompilerInput) {
    return debug("parameterListCompiler")(
        taggedCompilerGenerator("parameterList")(
            questionMark(
                sequence([
                    sequence([
                        typeCompiler,
                        wordCompilerGenerator("identifier"),
                    ]),
                    star(
                        sequence([
                            wordCompilerGenerator("symbol", ","),
                            typeCompiler,
                            wordCompilerGenerator("identifier"),
                        ])
                    ),
                ])
            )
        )
    )(params);
}

function varDecCompiler(params: CompilerInput) {
    return debug("varDecCompiler")(
        taggedCompilerGenerator("varDec")(
            sequence([
                wordCompilerGenerator("keyword", "var"),
                typeCompiler,
                wordCompilerGenerator("identifier"),
                star(
                    sequence([
                        wordCompilerGenerator("symbol", ","),
                        wordCompilerGenerator("identifier"),
                    ])
                ),
                wordCompilerGenerator("symbol", ";"),
            ])
        )
    )(params);
}

function letStatementCompiler(params: CompilerInput) {
    return debug("letStatementCompiler")(
        taggedCompilerGenerator("letStatement")(
            sequence([
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
            ])
        )
    )(params);
}

function ifStatementCompiler(params: CompilerInput) {
    return debug("ifStatementCompiler")(
        taggedCompilerGenerator("ifStatement")(
            sequence([
                wordCompilerGenerator("keyword", "if"),
                wordCompilerGenerator("symbol", "("),
                expressionCompiler,
                wordCompilerGenerator("symbol", ")"),
                wordCompilerGenerator("symbol", "{"),
                statementsCompiler,
                wordCompilerGenerator("symbol", "}"),
                questionMark(
                    sequence([
                        wordCompilerGenerator("keyword", "else"),
                        wordCompilerGenerator("symbol", "{"),
                        statementsCompiler,
                        wordCompilerGenerator("symbol", "}"),
                    ])
                ),
            ])
        )
    )(params);
}

function whileStatementCompiler(params: CompilerInput) {
    return debug("whileStatementCompiler")(
        taggedCompilerGenerator("whileStatement")(
            sequence([
                wordCompilerGenerator("keyword", "while"),
                wordCompilerGenerator("symbol", "("),
                expressionCompiler,
                wordCompilerGenerator("symbol", ")"),
                wordCompilerGenerator("symbol", "{"),
                statementsCompiler,
                wordCompilerGenerator("symbol", "}"),
            ])
        )
    )(params);
}

function expressionListCompiler(params: CompilerInput) {
    return debug("expressionListCompiler")(
        taggedCompilerGenerator("expressionList")(
            questionMark(
                sequence([
                    expressionCompiler,
                    star(
                        sequence([
                            wordCompilerGenerator("symbol", ","),
                            expressionCompiler,
                        ])
                    ),
                ])
            )
        )
    )(params);
}

function subroutineCallCompiler(params: CompilerInput) {
    return debug("subroutineCallCompiler")(
        alternate([
            sequence([
                wordCompilerGenerator("identifier"),
                wordCompilerGenerator("symbol", "("),
                expressionListCompiler,
                wordCompilerGenerator("symbol", ")"),
            ]),
            sequence([
                wordCompilerGenerator("identifier"),
                wordCompilerGenerator("symbol", "."),
                wordCompilerGenerator("identifier"),
                wordCompilerGenerator("symbol", "("),
                expressionListCompiler,
                wordCompilerGenerator("symbol", ")"),
            ]),
        ])
    )(params);
}

function doStatementCompiler(params: CompilerInput) {
    return debug("doStatementCompiler")(
        taggedCompilerGenerator("doStatement")(
            sequence([
                wordCompilerGenerator("keyword", "do"),
                subroutineCallCompiler,
                wordCompilerGenerator("symbol", ";"),
            ])
        )
    )(params);
}

function returnStatementCompiler(params: CompilerInput) {
    return debug("returnStatementCompiler")(
        taggedCompilerGenerator("returnStatement")(
            sequence([
                wordCompilerGenerator("keyword", "return"),
                questionMark(expressionCompiler),
                wordCompilerGenerator("symbol", ";"),
            ])
        )
    )(params);
}

function statementCompiler(params: CompilerInput) {
    return debug("statementCompiler")(
        alternate([
            letStatementCompiler,
            ifStatementCompiler,
            whileStatementCompiler,
            doStatementCompiler,
            returnStatementCompiler,
        ])
    )(params);
}

function statementsCompiler(params: CompilerInput) {
    return debug("statementsCompiler")(
        taggedCompilerGenerator("statements")(star(statementCompiler))
    )(params);
}

function subroutineBodyCompiler(params: CompilerInput) {
    return debug("subroutineBodyCompiler")(
        taggedCompilerGenerator("subroutineBody")(
            sequence([
                wordCompilerGenerator("symbol", "{"),
                star(varDecCompiler),
                statementsCompiler,
                wordCompilerGenerator("symbol", "}"),
            ])
        )
    )(params);
}

function subroutineDecCompiler(params: CompilerInput) {
    return debug("subroutineDecCompiler")(
        taggedCompilerGenerator("subroutineDec")(
            sequence([
                alternate([
                    wordCompilerGenerator("keyword", "constructor"),
                    wordCompilerGenerator("keyword", "function"),
                    wordCompilerGenerator("keyword", "method"),
                ]),
                alternate(
                    [wordCompilerGenerator("keyword", "void")].concat(
                        typeCompiler
                    )
                ),
                wordCompilerGenerator("identifier"),
                wordCompilerGenerator("symbol", "("),
                parameterListCompiler,
                wordCompilerGenerator("symbol", ")"),
                subroutineBodyCompiler,
            ])
        )
    )(params);
}

function classCompiler(params: CompilerInput) {
    return debug("classCompiler")(
        taggedCompilerGenerator("class")(
            sequence([
                wordCompilerGenerator("keyword", "class"),
                wordCompilerGenerator("identifier"),
                wordCompilerGenerator("symbol", "{"),
                star(classVarDecCompiler),
                star(subroutineDecCompiler),
                wordCompilerGenerator("symbol", "}"),
            ])
        )
    )(params);
}

const getTagAndString = (
    taggedExpression: string
): {
    tag: string;
    string: string;
} => {
    const match = taggedExpression.match(/<(.+?)>\s(.+?)\s<\/.+?>/);
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
