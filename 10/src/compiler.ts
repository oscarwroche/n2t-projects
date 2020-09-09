import * as fs from "fs";
import { classCompiler } from "./compilers/compilers";

const main = () => {
    const fileStringsByFileNames = readTokenizedFiles();
    for (const fileName in fileStringsByFileNames) {
        const outFileName = `${
            fileName.split(".").slice(0, -1)[0]
        }-COMPILED-TEST.xml`;
        const xmlTagList = fileStringsByFileNames[fileName].split("\r\n");
        const compiledLines = compile(xmlTagList.slice(1, -1));
        writeXmlFile(compiledLines.join("\r\n"), outFileName);
    }
    return "Done";
};

const readTokenizedFiles = () => {
    const cliArgs = process.argv.slice(2);
    const [fileOrDirName] = cliArgs;
    const stats = fs.statSync(fileOrDirName);
    if (stats.isFile()) {
        if (fileOrDirName.match(".xml")) {
            const fileString = fs.readFileSync(fileOrDirName, "utf8");
            return {
                [fileOrDirName]: fileString,
            };
        } else {
            throw new Error("File type is not .xml");
        }
    } else {
        const inFileNames: string[] = [];
        const fileStringsByFileNames: { [fileName: string]: string } = {};
        fs.readdirSync(fileOrDirName, "utf8")
            .filter((fileName) => fileName.match(".jack"))
            .map((fileName) => {
                inFileNames.push(fileName);
                fileStringsByFileNames[fileName] = fs.readFileSync(
                    fileOrDirName + fileName,
                    "utf8"
                );
            });
        return fileStringsByFileNames;
    }
};

const writeXmlFile = (fileString: string, fileName: string) => {
    fs.writeFileSync(fileName, fileString, "utf8");
};

const compile = (xmlTagList: string[]) =>
    classCompiler({ currentList: xmlTagList, currentOutput: [], tabSpace: "" })
        .currentOutput;

main();
