import { File, readFiles, writeFiles } from './io';
import SyntaxAnalyser from './analyser';

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
        const args: string[] = process.argv.slice(2);
        const files: File[] = await readFiles(args);
        const compiledFiles: File[] = compileFiles(files, args);
        writeFiles(compiledFiles);

        console.log('Compilation finished');
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main();
