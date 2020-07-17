const uuidv1 = require("uuidv1");
import * as fs from "fs";

const COMMENT_LINE_REGEX = /^\/\//;

const main = () => {
    const { fileStrings, inFileNames, outFileName } = readVmFiles();
    console.log("fileStrings in", fileStrings.slice(0, 20));
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
    console.log("translatedFileLines", translatedFileLines.slice(0, 20));
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
    console.log("fileString out", fileString);
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
            vmStackInstructionByMemorySegmentTranslationGenerator(inFileName)[
                command
            ][arg1](arg2)
        );
    } else {
        console.log(
            `Line translation error: invalid arguments in following line: ${vmLine}`
        );
    }
    return instructions.join("\r\n");
};

enum VmArithmeticInstruction {
    add = "add",
    sub = "sub",
    neg = "neg",
    eq = "eq",
    lt = "lt",
    gt = "gt",
    and = "and",
    or = "or",
    not = "not",
}

const isSomeEnum = <T>(e: T) => (token: any): token is T[keyof T] =>
    Object.values(e).includes(token as T[keyof T]);

const isVmArithmeticInstruction = isSomeEnum(VmArithmeticInstruction);

const vmArithmeticInstructionTranslationsGenerator: () => {
    [a in keyof typeof VmArithmeticInstruction]: string[];
} = () => {
    const identifier = uuidv1();
    const subExpressionsAndMem = [
        "@SP",
        "A=M-1",
        "D=M",
        "A=A-1",
        "M=M-D",
        "D=M",
        "@SP",
        "M=M-1",
    ];
    const comparisonConditional = (comparator: string) => [
        `@${comparator}-${identifier}`,
        `D;J${comparator}`,
        "@SP",
        "A=M-1",
        "M=0",
        `@AFTER${comparator}-${identifier}`,
        "0;JMP",
        `(${comparator}-${identifier})`,
        "@SP",
        "A=M-1",
        "M=-1",
        `(AFTER${comparator}-${identifier})`,
    ];
    const binaryOperation = (operator: string) => [
        "@SP",
        "A=M-1",
        "D=M",
        "A=A-1",
        `M=M${operator}D`,
        "@SP",
        "M=M-1",
    ];
    const unaryOperation = (operator: string) => [
        "@SP",
        "A=M-1",
        `M=${operator}M`,
    ];
    return {
        add: binaryOperation("+"),
        sub: binaryOperation("-"),
        neg: unaryOperation("-"),
        eq: subExpressionsAndMem.concat(comparisonConditional("EQ")),
        lt: subExpressionsAndMem.concat(comparisonConditional("LT")),
        gt: subExpressionsAndMem.concat(comparisonConditional("GT")),
        and: binaryOperation("&"),
        or: binaryOperation("|"),
        not: unaryOperation("!"),
    };
};

const vmStackInstructionByMemorySegmentTranslationGenerator: (
    inFileName: string
) => {
    [a in keyof typeof VmStackInstruction]: {
        [a in keyof typeof VmMemorySegment]: (x: number) => string[];
    };
} = (inFileName: string) => {
    const dereferencePointer = (pointer: string | number) => [
        `@${pointer}`,
        "D=A",
    ];
    const rememberSegmentAddress = (segment: string) => [
        `@${segment}`,
        "D=D+M",
    ];
    const rememberValueAtSegmentAddress = (segment: string, position: number) =>
        dereferencePointer(position)
            .concat(rememberSegmentAddress(segment))
            .concat(["A=D", "D=M"]);
    const genericPush = ["@SP", "A=M", `M=D`, "@SP", "M=M+1"];
    const genericPop = [
        "@13",
        "M=D",
        "@SP",
        "A=M-1",
        "D=M",
        "@13",
        "A=M",
        "M=D",
        "@SP",
        "M=M-1",
    ];
    return {
        push: {
            constant: (x: number) => dereferencePointer(x).concat(genericPush),
            local: (x: number) =>
                rememberValueAtSegmentAddress("LCL", x).concat(genericPush),
            argument: (x: number) =>
                rememberValueAtSegmentAddress("ARG", x).concat(genericPush),
            this: (x: number) =>
                rememberValueAtSegmentAddress("THIS", x).concat(genericPush),
            that: (x: number) =>
                rememberValueAtSegmentAddress("THAT", x).concat(genericPush),
            temp: (x: number) =>
                dereferencePointer(x)
                    .concat([`@5`, "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(genericPush),
            pointer: (x: number) =>
                dereferencePointer(x)
                    .concat([`@3`, "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(genericPush),
            static: (x: number) =>
                [`@${inFileName}.${x}`, "D=M"].concat(genericPush),
        },
        pop: {
            constant: (_: number) => {
                console.log("Cannot push into constant segment");
                return [];
            },
            local: (x: number) =>
                dereferencePointer(x)
                    .concat(rememberSegmentAddress("LCL"))
                    .concat(genericPop),
            argument: (x: number) =>
                dereferencePointer(x)
                    .concat(rememberSegmentAddress("ARG"))
                    .concat(genericPop),
            this: (x: number) =>
                dereferencePointer(x)
                    .concat(rememberSegmentAddress("THIS"))
                    .concat(genericPop),
            that: (x: number) =>
                dereferencePointer(x)
                    .concat(rememberSegmentAddress("THAT"))
                    .concat(genericPop),
            temp: (x: number) =>
                dereferencePointer(x)
                    .concat([`@5`, "D=D+A"])
                    .concat(genericPop),
            pointer: (x: number) =>
                dereferencePointer(x)
                    .concat([`@3`, "D=D+A"])
                    .concat(genericPop),
            static: (x: number) => [
                "@SP",
                "A=M-1",
                "D=M",
                `@${inFileName}.${x}`,
                "M=D",
                "@SP",
                "M=M-1",
            ],
        },
    };
};

enum VmStackInstruction {
    push = "push",
    pop = "pop",
}

const isVmStackInstruction = isSomeEnum(VmStackInstruction);

enum VmMemorySegment {
    constant = "constant",
    local = "local",
    argument = "argument",
    this = "this",
    that = "that",
    temp = "temp",
    pointer = "pointer",
    static = "static",
}

const isVmMemorySegment = isSomeEnum(VmMemorySegment);

const isCommentLine = (line: string) => !!line.match(COMMENT_LINE_REGEX);
const isBlankLine = (line: string) => line === "";

const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x);
const and = <T>(f: (x: T) => boolean) => (g: (x: T) => boolean) => (x: T) =>
    f(x) && g(x);

main();
