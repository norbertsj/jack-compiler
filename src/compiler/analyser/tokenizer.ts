import { KEYWORDS, SYMBOLS, MARKUP_SYMBOLS_MAP, TOKEN_SEPARATOR_REGEXP } from '../constants';
import { LexicalElement } from '../defines';
import { NumberedInput, Token } from '../types';

export class Tokenizer {
    private readonly tokens: Token[];
    private currentTokenIndex = 0;

    constructor(private readonly fileName: string, input: string[]) {
        this.tokens = this.tokenize(this.preProcess(input));
    }

    hasMoreTokens(): boolean {
        if (this.currentIndexIsUndefined() || this.currentTokenIndex < this.tokens.length - 1) {
            return true;
        }

        return false;
    }

    advance(): void {
        if (!this.hasMoreTokens()) {
            return;
        }

        this.currentTokenIndex = this.currentIndexIsUndefined() ? 0 : this.currentTokenIndex + 1;
    }

    look(): Token | null {
        if (this.currentIndexIsUndefined()) {
            return null;
        }

        return this.tokens[this.currentTokenIndex];
    }

    lookAhead(): Token | null {
        if (this.hasMoreTokens()) {
            return this.tokens[this.currentTokenIndex + 1];
        }

        return null;
    }

    getTokens(): string[] {
        return ['<tokens>', ...this.tokens.map((t) => t.xml), '</tokens>'];
    }

    private addLineNumbers(input: string[]): NumberedInput[] {
        return input.map((line, index) => ({
            line,
            lineNumber: index + 1,
        }));
    }

    private removeSingleLineComments(input: NumberedInput[]): NumberedInput[] {
        return input.map((item) => ({
            ...item,
            line: item.line
                .replace(/\/+\*([\s\S]*?)\*\//, '')
                .replace(/\/{2}.*$/, '')
                .trim(),
        }));
    }

    private removeMultilineComments(input: NumberedInput[]): NumberedInput[] {
        const output: NumberedInput[] = [];
        let multilineComment = false;

        for (const item of input) {
            if (/\/{1}\*+.*$/.test(item.line)) {
                multilineComment = true;
                output.push({ ...item, line: item.line.replace(/\/{1}\*+.*$/, '') });
                continue;
            }

            if (item.line.endsWith('*/')) {
                multilineComment = false;
                continue;
            }

            if (multilineComment) {
                continue;
            }

            output.push(item);
        }

        return output;
    }

    private removeEmptyLines(input: NumberedInput[]): NumberedInput[] {
        return input.filter((item) => item.line !== '' && item.line !== ' ');
    }

    private preProcess(input: string[]): NumberedInput[] {
        return this.removeEmptyLines(
            this.removeMultilineComments(this.removeSingleLineComments(this.addLineNumbers(input)))
        );
    }

    private tokenize(input: NumberedInput[]): Token[] {
        let tokens: Token[] = [];

        for (const item of input) {
            const rawTokens = item.line
                .split(TOKEN_SEPARATOR_REGEXP)
                .filter((str) => str !== '' && str !== ' ')
                .map((t) => t.trim());
            const generatedTokens = rawTokens.map((t) => this.generateToken(item.lineNumber, t));
            tokens = [...tokens, ...generatedTokens];
        }

        return tokens;
    }

    private generateToken(lineNumber: number, value: string): Token {
        const token: Token = {
            value,
            type: LexicalElement.IDENTIFIER,
            xml: `<identifier>${value}</identifier>`,
            fileName: this.fileName + '.jack',
            lineNumber,
        };

        if (KEYWORDS.includes(value)) {
            token.type = LexicalElement.KEYWORD;
            token.xml = `<keyword>${value}</keyword>`;
        }

        if (SYMBOLS.includes(value)) {
            token.type = LexicalElement.SYMBOL;
            token.xml = MARKUP_SYMBOLS_MAP.has(value)
                ? `<symbol>${MARKUP_SYMBOLS_MAP.get(value)}</symbol>`
                : `<symbol>${value}</symbol>`;
        }

        if (value.startsWith('"') && value.endsWith('"')) {
            token.type = LexicalElement.STRING;
            token.value = value.replace(/\"/g, '');
            token.xml = `<stringConstant>${value.replace(/\"/g, '')}</stringConstant>`;
        }

        if (!isNaN(parseInt(value, 10))) {
            token.type = LexicalElement.INTEGER;
            token.value = parseInt(value, 10);
            token.xml = `<integerConstant>${value}</integerConstant>`;
        }

        return token;
    }

    private currentIndexIsUndefined(): boolean {
        return typeof this.currentTokenIndex === 'undefined';
    }
}
