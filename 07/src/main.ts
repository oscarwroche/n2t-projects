const uuidv1 = require("uuidv1");
import { promises as fs } from "fs";

const COMMENT_LINE_REGEX = /^\/\//;

const main = async () => {
    const { fileString, fileName } = await readVmFile();
    const fileLines: string[] = fileString.split("\r\n");
    const translatedFileLines = fileLines
        .filter(and(not(isBlankLine))(not(isCommentLine)))
        .map((line: string) => line.trim())
        .map(translateLine);
    await writeAsmFile(translatedFileLines.join("\r\n"), fileName);
    return "Done";
};

const readVmFile = async () => {
    const cliArgs = process.argv.slice(2);
    const [fileName] = cliArgs;
    const fileString = await fs.readFile(fileName, "utf8");
    return { fileString, fileName };
};

const writeAsmFile = async (fileString: string, inFileName: string) => {
    const outFileName = `${inFileName.split(".")[0]}.asm`;
    await fs.writeFile(outFileName, fileString, "utf8");
};

const translateLine: (vmLine: string) => string = (vmLine: string) => {
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
            vmStackInstructionByMemorySegmentTranslationGenerator()[command][
                arg1
            ](arg2)
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

const vmStackInstructionByMemorySegmentTranslationGenerator: () => {
    [a in keyof typeof VmStackInstruction]: {
        [a in keyof typeof VmMemorySegment]: (x: number) => string[];
    };
} = () => {
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
}

const isVmMemorySegment = isSomeEnum(VmMemorySegment);

const isCommentLine = (line: string) => !!line.match(COMMENT_LINE_REGEX);
const isBlankLine = (line: string) => line === "";

const not = <T>(f: (x: T) => boolean) => (x: T) => !f(x);
const and = <T>(f: (x: T) => boolean) => (g: (x: T) => boolean) => (x: T) =>
    f(x) && g(x);

main().then(console.log).catch(console.log);
