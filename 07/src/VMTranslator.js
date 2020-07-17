"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var uuidv1 = require("uuidv1");
var fs = __importStar(require("fs"));
var COMMENT_LINE_REGEX = /^\/\//;
var main = function () {
    var _a = readVmFiles(), fileStrings = _a.fileStrings, inFileNames = _a.inFileNames, outFileName = _a.outFileName;
    var translatedFileLines = [];
    for (var i = 0; i < inFileNames.length; i++) {
        var fileLines = fileStrings[i].split("\r\n");
        translatedFileLines = translatedFileLines.concat(fileLines
            .filter(and(not(isBlankLine))(not(isCommentLine)))
            .map(function (line) { return line.trim(); })
            .map(translateLine(inFileNames[i].split(".vm")[0])));
    }
    writeAsmFile(translatedFileLines.join("\r\n"), outFileName);
    return "Done";
};
var readVmFiles = function () {
    var cliArgs = process.argv.slice(2);
    var fileOrDirName = cliArgs[0];
    var stats = fs.statSync(fileOrDirName);
    if (stats.isFile()) {
        if (fileOrDirName.match(".vm")) {
            var fileStrings = [fs.readFileSync(fileOrDirName, "utf8")];
            return {
                fileStrings: fileStrings,
                inFileNames: fileOrDirName.split("/").slice(-1),
                outFileName: fileOrDirName.split(".vm")[0] + ".asm",
            };
        }
        else {
            throw new Error("File type is not .vm");
        }
    }
    else {
        var inFileNames_1 = [];
        var fileStrings = fs
            .readdirSync(fileOrDirName, "utf8")
            .filter(function (fileName) { return fileName.match(".vm"); })
            .map(function (fileName) {
            inFileNames_1.push(fileName);
            return fs.readFileSync(fileOrDirName + fileName, "utf8");
        });
        var outFileName = "" + fileOrDirName + fileOrDirName.split("/").slice(-2)[0] + ".asm";
        return { fileStrings: fileStrings, inFileNames: inFileNames_1, outFileName: outFileName };
    }
};
var writeAsmFile = function (fileString, fileName) {
    fs.writeFileSync(fileName, fileString, "utf8");
};
var translateLine = function (inFileName) { return function (vmLine) {
    var instructions = ["// " + vmLine];
    var splitVmLines = vmLine.split(" ");
    var command = splitVmLines[0] ? splitVmLines[0] : undefined;
    var arg1 = splitVmLines[1] ? splitVmLines[1] : undefined;
    var arg2 = splitVmLines[2] ? Number(splitVmLines[2]) : undefined;
    if (isVmArithmeticInstruction(command)) {
        instructions = instructions.concat(vmArithmeticInstructionTranslationsGenerator()[command]);
    }
    else if (isVmStackInstruction(command) &&
        isVmMemorySegment(arg1) &&
        arg2 !== undefined) {
        instructions = instructions.concat(vmStackInstructionByMemorySegmentTranslationGenerator(inFileName)[command][arg1](arg2));
    }
    else {
        console.log("Line translation error: invalid arguments in following line: " + vmLine);
    }
    return instructions.join("\r\n");
}; };
var VmArithmeticInstruction;
(function (VmArithmeticInstruction) {
    VmArithmeticInstruction["add"] = "add";
    VmArithmeticInstruction["sub"] = "sub";
    VmArithmeticInstruction["neg"] = "neg";
    VmArithmeticInstruction["eq"] = "eq";
    VmArithmeticInstruction["lt"] = "lt";
    VmArithmeticInstruction["gt"] = "gt";
    VmArithmeticInstruction["and"] = "and";
    VmArithmeticInstruction["or"] = "or";
    VmArithmeticInstruction["not"] = "not";
})(VmArithmeticInstruction || (VmArithmeticInstruction = {}));
var isSomeEnum = function (e) { return function (token) {
    return Object.values(e).includes(token);
}; };
var isVmArithmeticInstruction = isSomeEnum(VmArithmeticInstruction);
var vmArithmeticInstructionTranslationsGenerator = function () {
    var identifier = uuidv1();
    var subExpressionsAndMem = [
        "@SP",
        "A=M-1",
        "D=M",
        "A=A-1",
        "M=M-D",
        "D=M",
        "@SP",
        "M=M-1",
    ];
    var comparisonConditional = function (comparator) { return [
        "@" + comparator + "-" + identifier,
        "D;J" + comparator,
        "@SP",
        "A=M-1",
        "M=0",
        "@AFTER" + comparator + "-" + identifier,
        "0;JMP",
        "(" + comparator + "-" + identifier + ")",
        "@SP",
        "A=M-1",
        "M=-1",
        "(AFTER" + comparator + "-" + identifier + ")",
    ]; };
    var binaryOperation = function (operator) { return [
        "@SP",
        "A=M-1",
        "D=M",
        "A=A-1",
        "M=M" + operator + "D",
        "@SP",
        "M=M-1",
    ]; };
    var unaryOperation = function (operator) { return [
        "@SP",
        "A=M-1",
        "M=" + operator + "M",
    ]; };
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
var vmStackInstructionByMemorySegmentTranslationGenerator = function (inFileName) {
    var dereferencePointer = function (pointer) { return [
        "@" + pointer,
        "D=A",
    ]; };
    var rememberSegmentAddress = function (segment) { return [
        "@" + segment,
        "D=D+M",
    ]; };
    var rememberValueAtSegmentAddress = function (segment, position) {
        return dereferencePointer(position)
            .concat(rememberSegmentAddress(segment))
            .concat(["A=D", "D=M"]);
    };
    var genericPush = ["@SP", "A=M", "M=D", "@SP", "M=M+1"];
    var genericPop = [
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
            constant: function (x) { return dereferencePointer(x).concat(genericPush); },
            local: function (x) {
                return rememberValueAtSegmentAddress("LCL", x).concat(genericPush);
            },
            argument: function (x) {
                return rememberValueAtSegmentAddress("ARG", x).concat(genericPush);
            },
            this: function (x) {
                return rememberValueAtSegmentAddress("THIS", x).concat(genericPush);
            },
            that: function (x) {
                return rememberValueAtSegmentAddress("THAT", x).concat(genericPush);
            },
            temp: function (x) {
                return dereferencePointer(x)
                    .concat(["@5", "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(genericPush);
            },
            pointer: function (x) {
                return dereferencePointer(x)
                    .concat(["@3", "D=D+A"])
                    .concat(["A=D", "D=M"])
                    .concat(genericPush);
            },
            static: function (x) {
                return ["@" + inFileName + "." + x, "D=M"].concat(genericPush);
            },
        },
        pop: {
            constant: function (_) {
                console.log("Cannot push into constant segment");
                return [];
            },
            local: function (x) {
                return dereferencePointer(x)
                    .concat(rememberSegmentAddress("LCL"))
                    .concat(genericPop);
            },
            argument: function (x) {
                return dereferencePointer(x)
                    .concat(rememberSegmentAddress("ARG"))
                    .concat(genericPop);
            },
            this: function (x) {
                return dereferencePointer(x)
                    .concat(rememberSegmentAddress("THIS"))
                    .concat(genericPop);
            },
            that: function (x) {
                return dereferencePointer(x)
                    .concat(rememberSegmentAddress("THAT"))
                    .concat(genericPop);
            },
            temp: function (x) {
                return dereferencePointer(x)
                    .concat(["@5", "D=D+A"])
                    .concat(genericPop);
            },
            pointer: function (x) {
                return dereferencePointer(x)
                    .concat(["@3", "D=D+A"])
                    .concat(genericPop);
            },
            static: function (x) { return [
                "@SP",
                "A=M-1",
                "D=M",
                "@" + inFileName + "." + x,
                "M=D",
                "@SP",
                "M=M-1",
            ]; },
        },
    };
};
var VmStackInstruction;
(function (VmStackInstruction) {
    VmStackInstruction["push"] = "push";
    VmStackInstruction["pop"] = "pop";
})(VmStackInstruction || (VmStackInstruction = {}));
var isVmStackInstruction = isSomeEnum(VmStackInstruction);
var VmMemorySegment;
(function (VmMemorySegment) {
    VmMemorySegment["constant"] = "constant";
    VmMemorySegment["local"] = "local";
    VmMemorySegment["argument"] = "argument";
    VmMemorySegment["this"] = "this";
    VmMemorySegment["that"] = "that";
    VmMemorySegment["temp"] = "temp";
    VmMemorySegment["pointer"] = "pointer";
    VmMemorySegment["static"] = "static";
})(VmMemorySegment || (VmMemorySegment = {}));
var isVmMemorySegment = isSomeEnum(VmMemorySegment);
var isCommentLine = function (line) { return !!line.match(COMMENT_LINE_REGEX); };
var isBlankLine = function (line) { return line === ""; };
var not = function (f) { return function (x) { return !f(x); }; };
var and = function (f) { return function (g) { return function (x) {
    return f(x) && g(x);
}; }; };
main();
