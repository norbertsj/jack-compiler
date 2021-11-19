import { createReadStream, createWriteStream, WriteStream, statSync, Stats, readdirSync } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';
import SyntaxAnalyser from './analyser';

interface OutputFile {
    data: string[];
    path: string;
}

function createOutputFile(data: string[], parsedPath: path.ParsedPath, ext: string): OutputFile {
    return {
        data,
        path: parsedPath.dir.length > 0 ? `${parsedPath.dir}/${parsedPath.name}.${ext}` : `${parsedPath.name}.${ext}`,
    };
}

function compileFile(input: string[]): string[] {
    return [];
}

function writeFile(file: OutputFile): void {
    const wstream: WriteStream = createWriteStream(file.path);

    for (const line of file.data) {
        wstream.write(line + '\n');
    }
}

function readFile(filePath: string): Promise<string[]> {
    return new Promise((resolve) => {
        const data: string[] = [];

        const rl = createInterface({
            input: createReadStream(filePath),
            crlfDelay: Infinity,
        });

        rl.on('line', (line) => data.push(line));

        rl.on('close', () => {
            resolve(data);
        });
    });
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
        const outputFiles: OutputFile[] = [];

        if (parsedPath.ext === '.jack' && !stats.isDirectory()) {
            const input: string[] = await readFile(providedPath);
            outputFiles.push(createOutputFile(compileFile(input), parsedPath, 'vm'));

            if (args.includes('--syntax-tree')) {
                outputFiles.push(createOutputFile(SyntaxAnalyser.getClass(input), parsedPath, 'xml'));
            }

            if (args.includes('--tokens')) {
                outputFiles.push(
                    createOutputFile(
                        SyntaxAnalyser.getClassTokens(input),
                        { ...parsedPath, name: parsedPath.name + 'T' },
                        'xml'
                    )
                );
            }
        } else if (parsedPath.ext === '' && stats.isDirectory() && readdirSync(providedPath).length > 0) {
            // compile a directory of files
            console.log('Directory compilation not implemented yet');
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
