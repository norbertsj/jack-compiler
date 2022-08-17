import { SyntaxAnalyser } from './analyser';
import { CodeGenerator } from './generator';

export type CompilerOutput = {
    tokens: string[];
    parseTreeXML: string[];
    vm: string[];
};

export class Compiler {
    static compile(input: string[]): CompilerOutput {
        const { tokens, parseTree, parseTreeXML } = SyntaxAnalyser.analyseClass(input);
        console.dir(parseTree, { depth: null });
        const generator = new CodeGenerator(parseTree);
        generator.generate();
        console.log(generator.getOutput());
        return { tokens, parseTreeXML, vm: generator.getOutput() };
    }
}
