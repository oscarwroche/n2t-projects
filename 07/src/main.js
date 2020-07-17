"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var uuidv1 = require("uuidv1");
var fs_1 = require("fs");
var COMMENT_LINE_REGEX = /^\/\//;
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var fileString, fileLines, translatedFileLines;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, readVmFile()];
            case 1:
                fileString = _a.sent();
                fileLines = fileString.split("\r\n");
                translatedFileLines = fileLines
                    .filter(and(not(isBlankLine))(not(isCommentLine)))
                    .map(function (line) { return line.trim(); })
                    .map(translateLine);
                return [4 /*yield*/, writeAsmFile(translatedFileLines.join("\r\n"))];
            case 2:
                _a.sent();
                return [2 /*return*/, "Done"];
        }
    });
}); };
var readVmFile = function () { return __awaiter(void 0, void 0, void 0, function () {
    var cliArgs, inFilename, outFilename, inFile;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log(process.argv);
                cliArgs = process.argv.slice(2);
                inFilename = cliArgs[0], outFilename = cliArgs[1];
                console.log(inFilename);
                return [4 /*yield*/, fs_1.promises.readFile(inFilename, "utf8")];
            case 1:
                inFile = _a.sent();
                return [2 /*return*/, inFile];
        }
    });
}); };
var writeAsmFile = function (fileString) { return __awaiter(void 0, void 0, void 0, function () {
    var cliArgs, inFilename, outFilename;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cliArgs = process.argv.slice(2);
                console.log(cliArgs);
                inFilename = cliArgs[0], outFilename = cliArgs[1];
                return [4 /*yield*/, fs_1.promises.writeFile(outFilename, fileString, "utf8")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var translateLine = function (vmLine) {
    var instructions = ["// " + vmLine];
    var splitVmLines = vmLine.split(" ");
    var command = splitVmLines[0] ? splitVmLines[0] : undefined;
    var arg1 = splitVmLines[1] ? splitVmLines[1] : undefined;
    var arg2 = splitVmLines[2] ? Number(splitVmLines[2]) : undefined;
    if (isVmArithmeticInstruction(command)) {
        instructions = instructions.concat(VM_ARITHMETIC_INSTRUCTION_TRANSLATIONS[command]);
    }
    else if (isVmStackInstruction(command) &&
        isVmMemorySegment(arg1) &&
        arg2) {
        instructions = instructions.concat(VM_STACK_INSTRUCTION_BY_MEMORY_SEGMENT_TRANSLATIONS[command][arg1](arg2));
    }
    else {
        console.log("Line translation error: invalid arguments in following line: " + vmLine);
    }
    return instructions.join("\r\n");
};
var VmArithmeticInstruction;
(function (VmArithmeticInstruction) {
    VmArithmeticInstruction["add"] = "add";
    VmArithmeticInstruction["sub"] = "sub";
    VmArithmeticInstruction["neg"] = "neg";
    VmArithmeticInstruction["eq"] = "eq";
    VmArithmeticInstruction["lt"] = "lt";
    VmArithmeticInstruction["and"] = "and";
    VmArithmeticInstruction["or"] = "or";
    VmArithmeticInstruction["not"] = "not";
})(VmArithmeticInstruction || (VmArithmeticInstruction = {}));
var isSomeEnum = function (e) { return function (token) {
    return Object.values(e).includes(token);
}; };
var isVmArithmeticInstruction = isSomeEnum(VmArithmeticInstruction);
var VM_ARITHMETIC_INSTRUCTION_TRANSLATIONS = (function () {
    var identifier = uuidv1();
    var subExpressions = [
        "@SP",
        "A=M-1",
        "D=M",
        "A=A-1",
        "M=M-D",
        "@SP",
        "M=M-1",
    ];
    return {
        add: ["@SP", "A=M-1", "D=M", "A=A-1", "M=M+D", "@SP", "M=M-1"],
        sub: subExpressions,
        neg: ["@SP", "A=M-1", "M=-M"],
        eq: subExpressions.concat([
            "@EQ" + identifier,
            "D;JEQ",
            "@SP",
            "M=0",
            "(EQ" + identifier + ")",
            "M=-1",
        ]),
        lt: subExpressions.concat([
            "@LT" + identifier,
            "D;JGT",
            "@SP",
            "M=0",
            "(LT" + identifier + ")",
            "M=-1",
        ]),
        gt: subExpressions.concat([
            "@GT" + identifier,
            "D;JLT",
            "@SP",
            "M=0",
            "(GT" + identifier + ")",
            "M=-1",
        ]),
        and: ["@SP", "A=M-1", "D=M", "A=A-1", "M=M&D", "@SP", "M=M-1"],
        or: ["@SP", "A=M-1", "D=M", "A=A-1", "M=M|D", "@SP", "M=M-1"],
        not: ["@SP", "A=M-1", "M=!M"]
    };
})();
var VM_STACK_INSTRUCTION_BY_MEMORY_SEGMENT_TRANSLATIONS = {
    push: {
        constant: function (x) { return ["@SP", "A=M-1", "M=" + x, "@SP", "M=M+1"]; }
    }
};
var VmStackInstruction;
(function (VmStackInstruction) {
    VmStackInstruction["push"] = "push";
})(VmStackInstruction || (VmStackInstruction = {}));
var isVmStackInstruction = isSomeEnum(VmStackInstruction);
var VmMemorySegment;
(function (VmMemorySegment) {
    VmMemorySegment["constant"] = "constant";
})(VmMemorySegment || (VmMemorySegment = {}));
var isVmMemorySegment = isSomeEnum(VmMemorySegment);
var isCommentLine = function (line) { return !!line.match(COMMENT_LINE_REGEX); };
var isBlankLine = function (line) { return line === ""; };
var not = function (f) { return function (x) { return !f(x); }; };
var and = function (f) { return function (g) { return function (x) {
    return f(x) && g(x);
}; }; };
main().then(console.log)["catch"](console.log);
