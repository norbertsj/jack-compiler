import { Parser, ParserOutput } from './parser';

export class SyntaxAnalyser {
    public static analyseClass(input: string[]): ParserOutput {
        const parser = new Parser(input);
        parser.parseClass();
        return parser.getOutput();
    }
}
