import Tokenizer from './tokenizer';
import Parser from './parser';

export default class SyntaxAnalyser {
    public static getClassTokens(input: string[]): string[] {
        const tokenizer = new Tokenizer(input);
        return tokenizer.getTokens();
    }

    public static getClass(input: string[]): string[] {
        const parser = new Parser(input);
        parser.parseClass();
        return parser.getOutput();
    }
}
