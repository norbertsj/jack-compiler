import { Compiler } from './compiler';
import { File, IO } from './io';

class Main {
    async main(): Promise<void> {
        const args = process.argv.slice(2);
        const files = await IO.readFiles(args);
        const compiledFiles = this.compileFiles(files, args);
        IO.writeFiles(compiledFiles);

        console.log('Compilation finished');
    }

    compileFiles(files: File[], args: string[]): File[] {
        const compiledFiles: File[] = [];

        for (const file of files) {
            const { tokens, parseTreeXML, vm } = Compiler.compile(file.name, file.data);

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
}

const program = new Main();
program.main().catch((e: Error) => console.error(e.stack));
