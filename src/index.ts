import { File, IO } from './io';
import { Tokenizer } from './tokenizer';
import { CompilationEngine } from './engine';

export default class SyntaxAnalyser {
    public static getClassTokens(input: string[]): string[] {
        const tokenizer = new Tokenizer(input);
        return tokenizer.getTokens();
    }

    public static getClass(input: string[]): string[] {
        const engine = new CompilationEngine(input);
        engine.compileClass();
        return engine.getOutput();
    }
}

function compileFiles(files: File[], args: string[]) {
    const compiledFiles: File[] = [];

    for (const file of files) {
        compiledFiles.push({
            name: file.name,
            extension: 'vm',
            dir: file.dir,
            data: [],
        });

        if (args.includes('--syntax-tree')) {
            compiledFiles.push({
                name: file.name,
                extension: 'xml',
                dir: file.dir,
                data: SyntaxAnalyser.getClass(file.data),
            });
        }

        if (args.includes('--tokens')) {
            compiledFiles.push({
                name: file.name + 'T',
                extension: 'xml',
                dir: file.dir,
                data: SyntaxAnalyser.getClassTokens(file.data),
            });
        }
    }

    return compiledFiles;
}

async function main(): Promise<void> {
    try {
        const args = process.argv.slice(2);
        const files = await IO.readFiles(args);
        const compiledFiles = compileFiles(files, args);
        IO.writeFiles(compiledFiles);

        console.log('Compilation finished');
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main();
