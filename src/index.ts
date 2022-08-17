import { Compiler } from './compiler';
import { File, IO } from './io';

function compileFiles(files: File[], args: string[]) {
    const compiledFiles: File[] = [];

    for (const file of files) {
        const { tokens, parseTreeXML, vm } = Compiler.compile(file.data);

        compiledFiles.push({
            name: file.name,
            extension: 'vm',
            dir: file.dir,
            data: vm,
        });

        if (args.includes('--parse-tree')) {
            compiledFiles.push({
                name: file.name,
                extension: 'xml',
                dir: file.dir,
                data: parseTreeXML,
            });
        }

        if (args.includes('--tokens')) {
            compiledFiles.push({
                name: file.name + 'T',
                extension: 'xml',
                dir: file.dir,
                data: tokens,
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
