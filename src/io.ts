import { createReadStream, createWriteStream, readdirSync, statSync, Stats } from 'fs';
import path, { ParsedPath } from 'path';
import { createInterface } from 'readline';

export type File = {
    name: string;
    extension: string;
    dir: string;
    data: string[];
};

export type PathInfo = {
    input: string;
    parsed: ParsedPath;
    stats: Stats;
};

export class IO {
    static readFile(filePath: string): Promise<string[]> {
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

    static async readFiles(args: string[]): Promise<File[]> {
        const pathInfo = IO.getPathInfo(args[0]);

        if (IO.isJackFile(pathInfo)) {
            return [
                {
                    name: pathInfo.parsed.name,
                    extension: null,
                    dir: pathInfo.parsed.dir,
                    data: await IO.readFile(pathInfo.input),
                },
            ];
        }

        if (IO.isNonEmptyDirectory(pathInfo)) {
            let files: File[] = [];
            const fileNames = readdirSync(pathInfo.input).filter((f) => f.includes('.jack'));
            for (const fileName of fileNames) {
                files.push({
                    name: fileName.replace('.jack', ''),
                    extension: null,
                    dir: `${pathInfo.parsed.dir}/${pathInfo.parsed.base}`,
                    data: await IO.readFile(`${pathInfo.input}/${fileName}`),
                });
            }

            return files;
        }

        throw new Error('Path argument is not valid (must be either a .jack file or an existing directory)');
    }

    static writeFile(file: File): void {
        const wstream = createWriteStream(`${file.dir}/${file.name}.${file.extension}`);

        for (const line of file.data) {
            wstream.write(line + '\n');
        }
    }

    static writeFiles(files: File[]): void {
        for (const file of files) {
            IO.writeFile(file);
        }
    }

    private static getPathInfo(input: string): PathInfo {
        if (!input) {
            throw new Error('Path is missing');
        }

        return {
            input,
            parsed: path.parse(input),
            stats: statSync(input),
        };
    }

    private static isJackFile(pathInfo: PathInfo): boolean {
        return pathInfo.parsed.ext === '.jack' && !pathInfo.stats.isDirectory();
    }

    private static isNonEmptyDirectory(pathInfo: PathInfo): boolean {
        return pathInfo.parsed.ext === '' && pathInfo.stats.isDirectory() && readdirSync(pathInfo.input).length > 0;
    }
}
