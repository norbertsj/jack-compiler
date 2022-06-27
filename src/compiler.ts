import { CompilationEngine } from './engine';

export type CompilerOutput = {
    tokens: string[];
    xml: string[];
    vm: string[];
};

export class Compiler {
    static compile(input: string[]): CompilerOutput {
        const engine = new CompilationEngine(input);
        engine.compile();
        return engine.getOutput();
    }
}
