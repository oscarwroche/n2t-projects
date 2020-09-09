export type CompilerInput = {
    currentList: string[];
    currentOutput: string[];
    tabSpace?: string;
    symbolTables?: SymbolTables;
    latestType?: string;
};

type CompilerOutput = CompilerInput;

export type Compiler = (params: CompilerInput) => CompilerOutput;

export type wordType =
    | "keyword"
    | "identifier"
    | "symbol"
    | "stringConstant"
    | "integerConstant";

export type SymbolTables = {
    class?: SymbolTable<"static" | "field">;
    subRoutine?: SymbolTable<"argument" | "var">;
};

export type SymbolTable<K> = {
    [identifier: string]: {
        kind: K;
        type: string;
        count: number;
    };
};
