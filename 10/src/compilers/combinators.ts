import { Compiler, CompilerInput } from "../types";

export function sequence(compilers: Compiler[]): Compiler {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        for (const compiler of compilers) {
            ({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            } = compiler({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            }));
        }
        return {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        };
    };
}

export function alternate(compilers: Compiler[]): Compiler {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        for (const compiler of compilers) {
            try {
                ({
                    currentList,
                    currentOutput,
                    tabSpace,
                    symbolTables,
                    latestType,
                } = compiler({
                    currentList,
                    currentOutput,
                    tabSpace,
                    symbolTables,
                    latestType,
                }));
                return {
                    currentList,
                    currentOutput,
                    tabSpace,
                    symbolTables,
                    latestType,
                };
            } catch (e) {}
        }
        throw Error("None of the supplied compilers worked");
    };
}

export function star(compiler: Compiler): Compiler {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        try {
            ({ currentList, currentOutput } = compiler({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            }));
            return star(compiler)({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            });
        } catch (e) {
            return {
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            };
        }
    };
}

export function questionMark(compiler: Compiler): Compiler {
    return function (params: CompilerInput) {
        let {
            currentList,
            currentOutput,
            tabSpace,
            symbolTables,
            latestType,
        } = params;
        try {
            ({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            } = compiler({
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            }));
            return {
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            };
        } catch (e) {
            return {
                currentList,
                currentOutput,
                tabSpace,
                symbolTables,
                latestType,
            };
        }
    };
}
