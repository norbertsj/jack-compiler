import { createReadStream, createWriteStream, WriteStream } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';

export interface OutputFile {
    data: string[];
    path: string;
}

export function createOutputFile(
    data: string[],
    fileName: string,
    parsedPath: path.ParsedPath,
    ext: string,
    fromDir: boolean = false
): OutputFile {
    return {
        data,
        path:
            parsedPath.dir.length > 0
                ? fromDir
                    ? `${parsedPath.dir}/${parsedPath.base}/${fileName}.${ext}`
                    : `${parsedPath.dir}/${parsedPath.name}.${ext}`
                : `${parsedPath.name}.${ext}`,
    };
}

export function writeFile(file: OutputFile): void {
    const wstream: WriteStream = createWriteStream(file.path);

    for (const line of file.data) {
        wstream.write(line + '\n');
    }
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
