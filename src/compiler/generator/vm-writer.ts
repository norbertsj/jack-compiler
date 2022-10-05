import { Command, MemorySegment } from '../defines';

export class VMWriter {
    private output: string[] = [];

    getOutput(): string[] {
        return this.output;
    }

    writePush(segment: MemorySegment, index: number) {
        this.output.push(`push ${segment} ${index}`);
    }

    writePop(segment: MemorySegment, index: number) {
        this.output.push(`pop ${segment} ${index}`);
    }

    writeArithmetic(command: Command) {
        this.output.push(command);
    }

    writeLabel(label: string) {
        this.output.push(`label ${label}`);
    }

    writeGoto(label: string) {
        this.output.push(`goto ${label}`);
    }

    writeIf(label: string) {
        this.output.push(`if-goto ${label}`);
    }

    writeCall(name: string, nArgs: number) {
        this.output.push(`call ${name} ${nArgs}`);
    }

    writeFunction(name: string, nLocals: number) {
        this.output.push(`function ${name} ${nLocals}`);
    }

    writeReturn() {
        this.output.push('return');
    }

    writeEmptyLine() {
        this.output.push('');
    }
}
