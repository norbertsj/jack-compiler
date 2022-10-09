import { Command, MemorySegment } from '../defines';

export class VMWriter {
    private output: string[] = [];

    getOutput(): string[] {
        return this.output;
    }

    writePush(segment: MemorySegment, index: number): void {
        this.output.push(`push ${segment} ${index}`);
    }

    writePop(segment: MemorySegment, index: number): void {
        this.output.push(`pop ${segment} ${index}`);
    }

    writeArithmetic(command: Command): void {
        this.output.push(command);
    }

    writeLabel(label: string): void {
        this.output.push(`label ${label}`);
    }

    writeGoto(label: string): void {
        this.output.push(`goto ${label}`);
    }

    writeIf(label: string): void {
        this.output.push(`if-goto ${label}`);
    }

    writeCall(name: string, nArgs: number): void {
        this.output.push(`call ${name} ${nArgs}`);
    }

    writeFunction(name: string, nLocals: number): void {
        this.output.push(`function ${name} ${nLocals}`);
    }

    writeReturn(): void {
        this.output.push('return');
    }

    writeEmptyLine(): void {
        this.output.push('');
    }
}
