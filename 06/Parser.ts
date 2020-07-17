import { promises as fs } from "fs";

const COMMENT_LINE_REGEX = /^\/\//;

const JUMP_INSTRUCTIONS_MAP = {
    JGT: "001",
    JEQ: "010",
    JGE: "011",
    JLT: "100",
    JNE: "101",
    JLE: "110",
    JMP: "111",
};

const isValidJumpInstruction = (
    value: string | undefined
): value is keyof typeof JUMP_INSTRUCTIONS_MAP =>
    !!(value && value in JUMP_INSTRUCTIONS_MAP);

const DEST_INSTRUCTIONS_MAP = {
    M: "001",
    D: "010",
    MD: "011",
    A: "100",
    AM: "101",
    AD: "110",
    AMD: "111",
};

const isValidDestInstruction = (
    value: string | undefined
): value is keyof typeof DEST_INSTRUCTIONS_MAP =>
    !!(value && value in DEST_INSTRUCTIONS_MAP);

const DEFAULT_COMP_INSTRUCTIONS_MAP = {
    "0": "101010",
    "1": "111111",
    "-1": "111010",
    D: "001100",
    "!D": "001101",
    "-D": "001111",
    "D+1": "011111",
    "D-1": "001110",
};

type DefaultCompInstructions = typeof DEFAULT_COMP_INSTRUCTIONS_MAP;

interface CustomCompInstructions extends DefaultCompInstructions {
    [k: string]: string;
}

const DEFAULT_SYMBOLS_MAP = {
    SP: 0,
    LCL: 1,
    ARG: 2,
    THIS: 3,
    THAT: 4,
    R0: 0,
    R1: 1,
    R2: 2,
    R3: 3,
    R4: 4,
    R5: 5,
    R6: 6,
    R7: 7,
    R8: 8,
    R9: 9,
    R10: 10,
    R11: 11,
    R12: 12,
    R13: 13,
    R14: 14,
    R15: 15,
    SCREEN: 16384,
};

type DefaultSymbols = typeof DEFAULT_SYMBOLS_MAP;

interface CustomSymbols extends DefaultSymbols {
    [k: string]: number;
}

const main = async () => {
    const fileString: string = await readAsmFile();
    const fileLines: string[] = fileString.split("\r\n");
    const filteredFileLines = fileLines
        .filter(and(not(isBlankLine))(not(isCommentLine)))
        .map(removeComment)
        .map((line: string) => line.trim());
    const linesWithTranslatedSymbols = translateSymbols(filteredFileLines);
    const parsedLines = linesWithTranslatedSymbols.map(parseLine);
    await writeHackFile(parsedLines.join("\r\n"));
    return "Done";
};

const translateSymbols = (lines: string[]) => {
    const customSymbolMap: CustomSymbols = DEFAULT_SYMBOLS_MAP;
    let allocationAddress = 16;
    let lineNumber = 0;
    const outputLines = [];
    // First Pass
    for (const line of lines) {
        const parenthesisMatch = line.match(/^\((.+)\)$/);
        if (parenthesisMatch) {
            customSymbolMap[parenthesisMatch[1]] = lineNumber;
        } else {
            ++lineNumber;
        }
    }
    lineNumber = 0;
    // Second Pass
    for (const line of lines) {
        const parenthesisMatch = line.match(/^\((.+)\)$/);
        if (!parenthesisMatch) {
            let lineToAdd = line;
            const aInstructionMatch = line.match(/@(.+)/);
            if (aInstructionMatch) {
                const symbolOrNumber = aInstructionMatch[1];
                if (
                    !symbolOrNumber.match(/^[0-9]+$/) &&
                    customSymbolMap[symbolOrNumber] === undefined
                ) {
                    customSymbolMap[`${symbolOrNumber}`] = allocationAddress;
                    lineToAdd = lineToAdd.replace(
                        symbolOrNumber,
                        `${allocationAddress}`
                    );
                    ++allocationAddress;
                } else if (customSymbolMap[symbolOrNumber] !== undefined) {
                    lineToAdd = lineToAdd.replace(
                        symbolOrNumber,
                        `${customSymbolMap[symbolOrNumber]}`
                    );
                }
            }
            outputLines.push(lineToAdd);
            ++lineNumber;
        }
    }
    return outputLines;
};

const compInstructionsMap = (compVariable: string) => {
    const customCompInstructionsMap: CustomCompInstructions = DEFAULT_COMP_INSTRUCTIONS_MAP;
    customCompInstructionsMap[compVariable] = "110000";
    customCompInstructionsMap[`!${compVariable}`] = "110001";
    customCompInstructionsMap[`-${compVariable}`] = "110011";
    customCompInstructionsMap[`${compVariable}+1`] = "110111";
    customCompInstructionsMap[`${compVariable}-1`] = "110010";
    customCompInstructionsMap[`D+${compVariable}`] = "000010";
    customCompInstructionsMap[`D-${compVariable}`] = "010011";
    customCompInstructionsMap[`${compVariable}-D`] = "000111";
    customCompInstructionsMap[`D&${compVariable}`] = "000000";
    customCompInstructionsMap[`D|${compVariable}`] = "010101";
    return customCompInstructionsMap;
};

const readAsmFile = async () => {
    const cliArgs = process.argv.slice(2);
    const [inFilename, outFilename] = cliArgs;
    const inFile = await fs.readFile(inFilename, "utf8");
    return inFile;
};

const writeHackFile = async (fileString: string) => {
    const cliArgs = process.argv.slice(2);
    const [inFilename, outFilename] = cliArgs;
    await fs.writeFile(outFilename, fileString, "utf8");
};

const isCommentLine = (line: string) => !!line.match(COMMENT_LINE_REGEX);
const isBlankLine = (line: string) => line === "";

const removeComment = (line: string) => line.replace(/\/\/.+/, "");

const parseLine = (line: string) =>
    isAInstruction(line) ? parseAInstruction(line) : parseCInstruction(line);

const isAInstruction = (line: string) => !!line.match("@");

const parseAInstruction = (line: string) =>
    `0${parseInt(line.slice(1)).toString(2).padStart(15, "0")}`;
const parseCInstruction = (line: string) => {
    const [part1, part2] = line.split("=");
    const destInstruction = part2 ? part1 : undefined;
    const [compInstruction, jumpInstruction] = (destInstruction
        ? part2
        : part1
    ).split(";");
    return `111${parseCompInstruction(compInstruction)}${parseDestInstruction(
        destInstruction
    )}${parseJumpInstruction(jumpInstruction)}`;
};

const parseCompInstruction = (compInstruction: string) => {
    const [compVariable, compBit] = !!compInstruction.match("M")
        ? ["M", "1"]
        : ["A", "0"];
    return `${compBit}${compInstructionsMap(compVariable)[compInstruction]}`;
};
const parseDestInstruction = (destInstruction: string | undefined) =>
    isValidDestInstruction(destInstruction)
        ? DEST_INSTRUCTIONS_MAP[destInstruction]
        : "000";
const parseJumpInstruction = (jumpInstruction: string) =>
    isValidJumpInstruction(jumpInstruction)
        ? JUMP_INSTRUCTIONS_MAP[jumpInstruction]
        : "000";

const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x);
const and = <T>(f: (x: T) => boolean) => (g: (x: T) => boolean) => (x: T) =>
    f(x) && g(x);

main().then(console.log).catch(console.log);
