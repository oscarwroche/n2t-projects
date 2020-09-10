import {
    CompilerInput,
    Compiler,
    wordType,
    AdditionalTagInformation,
} from "../types";
import { getTagAndString } from "./utils";
import { alternate, sequence, star, questionMark } from "./combinators";

const debug = function (debugString: string) {
    return function (f: Compiler) {
        return sequence([debugCompilerGenerator(debugString), f]);
    };
};

const taggedCompilerGenerator = (tag: string) => (
    compiler: Compiler
): Compiler => {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        currentOutput = currentOutput.concat([`${tabSpace}<${tag}>`]);
        ({ currentList, currentOutput } = compiler({
            currentList,
            currentOutput,
            tabSpace: `  ${tabSpace}`,
            symbolTables,
            latestType,
        }));
        currentOutput = currentOutput.concat([`${tabSpace}</${tag}>`]);
        return {
            currentList,
            currentOutput,
            tabSpace, // ???
            symbolTables,
            latestType,
        };
    };
};

// Symbol table : pass another argument with the current symbol table, and info to know the kind of the current variable
function wordCompilerGenerator(
    type: wordType,
    word?: string,
    kind?: "static" | "field" | "argument" | "var",
    rememberType?: boolean
) {
    return debug(`rememberType: ${rememberType}`)((params: CompilerInput) => {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        const currentTagAndString = getTagAndString(currentList[0]);
        if (
            (!word && currentTagAndString.tag === type) ||
            (word &&
                currentTagAndString.tag === type &&
                currentTagAndString.string === word)
        ) {
            let newOutput = `${tabSpace}${currentList[0]}`;
            if (type === "identifier") {
                if (symbolTables && latestType) {
                    if (
                        symbolTables.subRoutine &&
                        (kind === "argument" || kind === "var")
                    ) {
                        const newSymbolObject = {
                            type: latestType,
                            kind,
                            count: Object.values(
                                symbolTables.subRoutine
                            ).filter((symbolValue) => symbolValue.kind === kind)
                                .length,
                        };
                        symbolTables.subRoutine[
                            currentTagAndString.string
                        ] = newSymbolObject;
                        newOutput = addValuesToTag(newOutput, {
                            ...symbolTables.subRoutine[
                                currentTagAndString.string
                            ],
                            usedOrDefined: "defined",
                        });
                    } else if (
                        symbolTables.class &&
                        (kind === "static" || kind === "field")
                    ) {
                        const newSymbolObject = {
                            type: latestType,
                            kind,
                            count: Object.values(symbolTables.class).filter(
                                (symbolValue) => symbolValue.kind === kind
                            ).length,
                        };
                        symbolTables.class[
                            currentTagAndString.string
                        ] = newSymbolObject;
                        newOutput = addValuesToTag(newOutput, {
                            ...symbolTables.class[currentTagAndString.string],
                            usedOrDefined: "defined",
                        });
                    }
                } else if (
                    symbolTables &&
                    symbolTables.subRoutine &&
                    symbolTables.subRoutine[currentTagAndString.string]
                ) {
                    newOutput = addValuesToTag(newOutput, {
                        ...symbolTables.subRoutine[currentTagAndString.string],
                        usedOrDefined: "used",
                    });
                } else if (
                    symbolTables &&
                    symbolTables.class &&
                    symbolTables.class[currentTagAndString.string]
                ) {
                    newOutput = addValuesToTag(newOutput, {
                        ...symbolTables.class[currentTagAndString.string],
                        usedOrDefined: "used",
                    });
                }
            }
            return {
                currentList: currentList.slice(1),
                currentOutput: currentOutput.concat(newOutput),
                tabSpace,
                symbolTables,
                latestType: rememberType
                    ? currentTagAndString.string
                    : undefined,
            };
        } else {
            throw new Error(
                `Error : identifier is ${word}, but current list is ${currentList}`
            );
        }
    });
}

function debugCompilerGenerator(debugString: string) {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        console.log("DEBUG : symbolTables", symbolTables);
        return {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        };
    };
}

function addValuesToTag<K>(tag: string, object: AdditionalTagInformation<K>) {
    return tag.replace(
        "<identifier>",
        `<identifier ${JSON.stringify(object)}>`
    );
}

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
            wordCompilerGenerator("keyword", "int", undefined, true),
            wordCompilerGenerator("keyword", "char", undefined, true),
            wordCompilerGenerator("keyword", "boolean", undefined, true),
            wordCompilerGenerator("identifier", undefined, undefined, true),
        ])
    )(params);
}

function classVarDecCompiler(params: CompilerInput) {
    return debug("classVarDecCompiler")(
        taggedCompilerGenerator("classVarDec")(
            sequence([
                alternate([
                    sequence([
                        wordCompilerGenerator("keyword", "static"),
                        typeCompiler,
                        wordCompilerGenerator(
                            "identifier",
                            undefined,
                            "static"
                        ),
                        star(
                            sequence([
                                wordCompilerGenerator("symbol", ","),
                                wordCompilerGenerator(
                                    "identifier",
                                    undefined,
                                    "static"
                                ),
                            ])
                        ),
                    ]),
                    sequence([
                        wordCompilerGenerator("keyword", "field"),
                        typeCompiler,
                        wordCompilerGenerator("identifier", undefined, "field"),
                        star(
                            sequence([
                                wordCompilerGenerator("symbol", ","),
                                wordCompilerGenerator(
                                    "identifier",
                                    undefined,
                                    "field"
                                ),
                            ])
                        ),
                    ]),
                ]),
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
                        wordCompilerGenerator(
                            "identifier",
                            undefined,
                            "argument"
                        ),
                    ]),
                    star(
                        sequence([
                            wordCompilerGenerator("symbol", ","),
                            typeCompiler,
                            wordCompilerGenerator(
                                "identifier",
                                undefined,
                                "argument"
                            ),
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
                wordCompilerGenerator("identifier", undefined, "var"),
                star(
                    sequence([
                        wordCompilerGenerator("symbol", ","),
                        wordCompilerGenerator("identifier", undefined, "var"),
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

function initSymbolTable(
    compiler: Compiler,
    type: "class" | "subRoutine"
): Compiler {
    return (params: CompilerInput) =>
        compiler({
            ...params,
            symbolTables: {
                ...params.symbolTables,
                [type]: {},
            },
        });
}

export function classCompiler(params: CompilerInput) {
    return debug("classCompiler")(
        taggedCompilerGenerator("class")(
            initSymbolTable(
                sequence([
                    wordCompilerGenerator("keyword", "class"),
                    wordCompilerGenerator("identifier"),
                    wordCompilerGenerator("symbol", "{"),
                    star(classVarDecCompiler),
                    star(initSymbolTable(subroutineDecCompiler, "subRoutine")),
                    wordCompilerGenerator("symbol", "}"),
                ]),
                "class"
            )
        )
    )(params);
}
