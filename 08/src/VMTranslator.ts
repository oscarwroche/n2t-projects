import * as fs from "fs";

const COMMENT_LINE_REGEX = /^\/\//;

const main = () => {
    const { fileStrings, inFileNames, outFileName } = readVmFiles();
    let translatedFileLines: string[] = [];
    for (let i = 0; i < inFileNames.length; i++) {
        const fileLines: string[] = fileStrings[i].split("\r\n");
        translatedFileLines = translatedFileLines.concat(
            fileLines
                .filter(and(not(isBlankLine))(not(isCommentLine)))
                .map((line: string) => line.trim())
                .map(translateLine(inFileNames[i].split(".vm")[0]))
        );
    }
    writeAsmFile(translatedFileLines.join("\r\n"), outFileName);
    return "Done";
};

const readVmFiles = () => {
    const cliArgs = process.argv.slice(2);
    const [fileOrDirName] = cliArgs;
    const stats = fs.statSync(fileOrDirName);
    if (stats.isFile()) {
        if (fileOrDirName.match(".vm")) {
            const fileStrings = [fs.readFileSync(fileOrDirName, "utf8")];
            return {
                fileStrings,
                inFileNames: fileOrDirName.split("/").slice(-1),
                outFileName: `${fileOrDirName.split(".vm")[0]}.asm`,
            };
        } else {
            throw new Error("File type is not .vm");
        }
    } else {
        const inFileNames: string[] = [];
        const fileStrings = fs
            .readdirSync(fileOrDirName, "utf8")
            .filter((fileName) => fileName.match(".vm"))
            .map((fileName) => {
                inFileNames.push(fileName);
                return fs.readFileSync(fileOrDirName + fileName, "utf8");
            });
        const outFileName = `${fileOrDirName}${
            fileOrDirName.split("/").slice(-2)[0]
        }.asm`;
        return { fileStrings, inFileNames, outFileName };
    }
};

const writeAsmFile = (fileString: string, fileName: string) => {
    fs.writeFileSync(fileName, fileString, "utf8");
};

const translateLine: (inFileName: string) => (vmLine: string) => string = (
    inFileName: string
) => (vmLine: string) => {
    let instructions = [`// ${vmLine}`];
    const splitVmLines = vmLine.split(" ");
    const command = splitVmLines[0] ? splitVmLines[0] : undefined;
    const arg1 = splitVmLines[1] ? splitVmLines[1] : undefined;
    const arg2 = splitVmLines[2] ? Number(splitVmLines[2]) : undefined;
    try {
        if (isVmArithmeticInstruction(command)) {
            instructions = instructions.concat(
                vmArithmeticInstructionTranslationsGenerator()[command]
            );
        } else if (
            isVmStackInstruction(command) &&
            isVmMemorySegment(arg1) &&
            arg2 !== undefined
        ) {
            instructions = instructions.concat(
                vmStackInstructionByMemorySegmentTranslationGenerator(
                    inFileName
                )[command][arg1](arg2)
            );
        } else if (isVmProgramFlowInstruction(command) && arg1 !== undefined) {
            instructions = instructions.concat(
                vmProgramFlowInstructionGenerator[command](arg1)
            );
        } else if (isVmFunctionInstruction(command)) {
            if (
                (command === "call" || command === "function") &&
                arg1 !== undefined &&
                arg2 !== undefined
            ) {
                instructions = instructions.concat(
                    vmFunctionInstructionGenerator[command](arg1, arg2)
                );
            } else if (command === "return") {
                instructions = instructions.concat(
                    vmFunctionInstructionGenerator["return"]
                );
            } else {
                throw new Error(
                    `Wrong function call parameter in following line: ${vmLine}`
                );
            }
        } else {
            throw new Error(
                `Line translation error: invalid arguments in following line: ${vmLine}`
            );
        }
    } catch (e) {
        console.log(`Error: ${e}`);
    }
    return instructions.join("\r\n");
};

const isCommentLine = (line: string) => !!line.match(COMMENT_LINE_REGEX);
const isBlankLine = (line: string) => line === "";

const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x);
const and = <T>(f: (x: T) => boolean) => (g: (x: T) => boolean) => (x: T) =>
    f(x) && g(x);

main();
