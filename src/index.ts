import { statSync, Stats, readdirSync } from 'fs';
import * as path from 'path';
import { writeFile, readFile, OutputFile, createOutputFile } from './io';
import SyntaxAnalyser from './analyser';

function compileVM(input: string[]): string[] {
    return [];
}

async function compile(
    filePath: string,
    fileName: string,
    parsedPath: path.ParsedPath,
    args: string[],
    fromDir: boolean = false
): Promise<OutputFile[]> {
    const outputFiles: OutputFile[] = [];

    const input: string[] = await readFile(filePath);
    outputFiles.push(createOutputFile(compileVM(input), fileName, parsedPath, 'vm', fromDir));

    if (args.includes('--syntax-tree')) {
        outputFiles.push(createOutputFile(SyntaxAnalyser.getClass(input), fileName, parsedPath, 'xml', fromDir));
    }

    if (args.includes('--tokens')) {
        outputFiles.push(
            createOutputFile(
                SyntaxAnalyser.getClassTokens(input),
                fileName + 'T',
                { ...parsedPath, name: parsedPath.name + 'T' },
                'xml',
                fromDir
            )
        );
    }

    return outputFiles;
}

async function main(): Promise<void> {
    try {
        const args: string[] = process.argv.slice(2);
        const providedPath: string = args[0];

        if (!providedPath) {
            throw new Error('Path argument is missing');
        }

        const parsedPath: path.ParsedPath = path.parse(providedPath);
        const stats: Stats = statSync(providedPath);
        let outputFiles: OutputFile[] = [];

        if (parsedPath.ext === '.jack' && !stats.isDirectory()) {
            outputFiles = await compile(providedPath, '', parsedPath, args);
        } else if (parsedPath.ext === '' && stats.isDirectory() && readdirSync(providedPath).length > 0) {
            const fileNames: string[] = readdirSync(providedPath).filter((f) => f.includes('.jack'));
            for (const fileName of fileNames) {
                outputFiles = [
                    ...outputFiles,
                    ...(await compile(
                        `${providedPath}/${fileName}`,
                        fileName.replace('.jack', ''),
                        parsedPath,
                        args,
                        true
                    )),
                ];
            }
        } else {
            throw new Error('Path argument is not valid (must be either a .jack file or an existing directory)');
        }

        for (const file of outputFiles) {
            writeFile(file);
        }

        console.log('Compilation finished');
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main();
