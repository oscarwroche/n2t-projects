const uuidv1 = require("uuidv1");

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

const utils = {
    genericPush: ["@SP", "A=M", `M=D`, "@SP", "M=M+1"],
    genericPop: [
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
    ],
    dereferencePointer: (pointer: string | number) => [`@${pointer}`, "D=A"],
};

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
    const rememberSegmentAddress = (segment: string) => [
        `@${segment}`,
        "D=D+M",
    ];
    const rememberValueAtSegmentAddress = (segment: string, position: number) =>
        utils
            .dereferencePointer(position)
            .concat(rememberSegmentAddress(segment))
            .concat(["A=D", "D=M"]);
    return {
        push: {
            constant: (x: number) =>
                utils.dereferencePointer(x).concat(utils.genericPush),
            local: (x: number) =>
                rememberValueAtSegmentAddress("LCL", x).concat(
                    utils.genericPush
                ),
            argument: (x: number) =>
                rememberValueAtSegmentAddress("ARG", x).concat(
                    utils.genericPush
                ),
            this: (x: number) =>
                rememberValueAtSegmentAddress("THIS", x).concat(
                    utils.genericPush
                ),
            that: (x: number) =>
                rememberValueAtSegmentAddress("THAT", x).concat(
                    utils.genericPush
                ),
            temp: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat([`@5`, "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(utils.genericPush),
            pointer: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat([`@3`, "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(utils.genericPush),
            static: (x: number) =>
                [`@${inFileName}.${x}`, "D=M"].concat(utils.genericPush),
        },
        pop: {
            constant: (_: number) => {
                console.log("Cannot push into constant segment");
                return [];
            },
            local: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat(rememberSegmentAddress("LCL"))
                    .concat(utils.genericPop),
            argument: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat(rememberSegmentAddress("ARG"))
                    .concat(utils.genericPop),
            this: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat(rememberSegmentAddress("THIS"))
                    .concat(utils.genericPop),
            that: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat(rememberSegmentAddress("THAT"))
                    .concat(utils.genericPop),
            temp: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat([`@5`, "D=D+A"])
                    .concat(utils.genericPop),
            pointer: (x: number) =>
                utils
                    .dereferencePointer(x)
                    .concat([`@3`, "D=D+A"])
                    .concat(utils.genericPop),
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

const vmProgramFlowInstructionGenerator = {
    goto: (labelName: string) => [`@${labelName}`, "0;JMP"],
    "if-goto": (labelName: string) => [
        "@SP",
        "A=M-1",
        "D=M",
        "@SP",
        "M=M-1",
        `@${labelName}`,
        "D;JNE",
    ],
    label: (labelName: string) => `(${labelName})`,
};

const vmFunctionInstructionGenerator = {
    call: (functionName: string, nArgs: number) => {
        const returnAddress = uuidv1();
        return [
            `@RETURN-ADDRESS-${returnAddress}`,
            "@LCL",
            "@ARG",
            "@THIS",
            "@THAT",
        ]
            .map(utils.dereferencePointer)
            .map((chunk: string[]) => chunk.concat(utils.genericPush))
            .flat()
            .concat([
                "@SP",
                "D=M",
                "@5",
                "D=D-A",
                `@${nArgs}`,
                "D=D-A",
                "@ARG",
                "M=D",
            ])
            .concat(["@SP", "D=M", "@LCL", "M=D"])
            .concat(vmProgramFlowInstructionGenerator.goto(functionName))
            .concat(`(RETURN-ADDRESS-${returnAddress})`);
    },
    function: (labelName: string, nVars: number) =>
        Array(nVars)
            .fill(utils.dereferencePointer(0).concat(utils.genericPush))
            .flat(),
    return: ["@LCL", "D=M", "@5", "D=D-A", "A=D", "D=M", "@14", "M=D"]
        .concat(["@ARG", "A=M", "D=A"])
        .concat(utils.genericPop)
        .concat(["@ARG", "D=M+1", "@SP", "M=D"])
        .concat(["@14", "A=M-1", "D=M", "@THAT", "M=D"]),
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

enum VmProgramFlowInstruction {
    goto = "goto",
    ifGoto = "if-goto",
    label = "label",
}

const isVmProgramFlowInstruction = isSomeEnum(VmProgramFlowInstruction);

enum VmFunctionInstruction {
    call = "call",
    function = "function",
    return = "return",
}

const isVmFunctionInstruction = isSomeEnum(VmFunctionInstruction);
