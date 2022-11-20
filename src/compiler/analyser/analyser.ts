import { Parser, ParserOutput } from './parser';

export class SyntaxAnalyser {
    public static analyseClass(fileName: string, input: string[]): ParserOutput {
        const parser = new Parser(fileName, input);
        parser.parseClass();
        return parser.getOutput();
    }
}
