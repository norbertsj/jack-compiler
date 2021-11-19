import { createReadStream, createWriteStream, WriteStream, Stats, statSync, readdirSync } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';

export interface File {
    name: string;
    extension: string;
    dir: string;
    data: string[];
}

export function readFile(filePath: string): Promise<string[]> {
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

export async function readFiles(args: string[]): Promise<File[]> {
    const providedPath: string = args[0];

    if (!providedPath) {
        throw new Error('Path argument is missing');
    }

    const parsedPath: path.ParsedPath = path.parse(providedPath);
    const stats: Stats = statSync(providedPath);
    let files: File[] = [];

    if (parsedPath.ext === '.jack' && !stats.isDirectory()) {
        files.push({
            name: parsedPath.name,
            extension: null,
            dir: parsedPath.dir,
            data: await readFile(providedPath),
        });
    } else if (parsedPath.ext === '' && stats.isDirectory() && readdirSync(providedPath).length > 0) {
        const fileNames: string[] = readdirSync(providedPath).filter((f) => f.includes('.jack'));
        for (const fileName of fileNames) {
            files.push({
                name: fileName.replace('.jack', ''),
                extension: null,
                dir: `${parsedPath.dir}/${parsedPath.base}`,
                data: await readFile(`${providedPath}/${fileName}`),
            });
        }
    } else {
        throw new Error('Path argument is not valid (must be either a .jack file or an existing directory)');
    }

    return files;
}

export function writeFile(file: File): void {
    const wstream: WriteStream = createWriteStream(`${file.dir}/${file.name}.${file.extension}`);

    for (const line of file.data) {
        wstream.write(line + '\n');
    }
}

export function writeFiles(files: File[]): void {
    for (const file of files) {
        writeFile(file);
    }
}
