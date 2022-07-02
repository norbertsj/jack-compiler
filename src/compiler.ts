import { SyntaxAnalyser } from './analyser';

export type CompilerOutput = {
    tokens: string[];
    parseTree: string[];
    vm: string[];
};

export class Compiler {
    static compile(input: string[]): CompilerOutput {
        const { tokens, parseTree } = SyntaxAnalyser.analyseClass(input);
        return { tokens, parseTree, vm: [] };
    }
}
