import { SyntaxAnalyser } from './analyser';
import { CodeGenerator } from './generator';

export { JackSyntaxError } from './error';

export type CompilerOutput = {
    tokens: string[];
    parseTreeXML: string[];
    vm: string[];
};

export class Compiler {
    static compile(fileName: string, input: string[]): CompilerOutput {
        const { tokens, parseTree, parseTreeXML } = SyntaxAnalyser.analyseClass(fileName, input);

        const generator = new CodeGenerator(parseTree);
        generator.generate();

        return { tokens, parseTreeXML, vm: generator.getOutput() };
    }
}
