import { KEYWORDS, SYMBOLS, MARKUP_SYMBOLS_MAP, TOKEN_SEPARATOR_REGEXP } from './defines';
import Token from './token';

export default class Tokenizer {
    private readonly tokens: Token[];
    private currentTokenIndex: number;

    public constructor(input: string[]) {
        this.tokens = this.tokenize(this.removeComments(input));
    }

    public hasMoreTokens(): boolean {
        if (this.currentIndexIsUndefined() || this.currentTokenIndex < this.tokens.length - 1) {
            return true;
        }

        return false;
    }

    public advance(): void {
        if (!this.hasMoreTokens()) {
            return;
        }

        this.currentTokenIndex = this.currentIndexIsUndefined() ? 0 : this.currentTokenIndex + 1;
    }

    public look(): Token | null {
        if (this.currentIndexIsUndefined()) {
            return null;
        }

        return this.tokens[this.currentTokenIndex];
    }

    public lookAhead(): Token | null {
        if (this.hasMoreTokens()) {
            return this.tokens[this.currentTokenIndex + 1];
        }

        return null;
    }

    public getTokens(): string[] {
        return ['<tokens>', ...this.tokens.map((t) => t.xml), '</tokens>'];
    }

    private removeComments(input: string[]): string[] {
        // joining the input lines and applying regexp to multiline string
        return input
            .join('\n')
            .replace(/\/+\*([\s\S]*?)\*\//gm, '')
            .replace(/\/{2}.*$/gm, '')
            .trim()
            .split('\n')
            .filter((line) => line.length > 0);
    }

    private tokenize(input: string[]): Token[] {
        let tokens: Token[] = [];

        for (const line of input) {
            const rawTokens = line
                .split(TOKEN_SEPARATOR_REGEXP)
                .filter((rt) => rt !== '' && rt !== ' ')
                .map((t) => t.trim());
            const generatedTokens = rawTokens.map((t) => this.generateToken(t));
            tokens = [...tokens, ...generatedTokens];
        }

        return tokens;
    }

    private generateToken(value: string): Token {
        const token: Token = {
            value,
            type: 'IDENTIFIER',
            xml: `<identifier>${value}</identifier>`,
        };

        if (KEYWORDS.includes(value)) {
            token.type = 'KEYWORD';
            token.xml = `<keyword>${value}</keyword>`;
        }

        if (SYMBOLS.includes(value)) {
            token.type = 'SYMBOL';
            token.xml = MARKUP_SYMBOLS_MAP.has(value)
                ? `<symbol>${MARKUP_SYMBOLS_MAP.get(value)}</symbol>`
                : `<symbol>${value}</symbol>`;
        }

        if (value.startsWith('"') && value.endsWith('"')) {
            token.type = 'STRING_CONST';
            token.value = value.replace(/\"/g, '');
            token.xml = `<stringConstant>${value.replace(/\"/g, '')}</stringConstant>`;
        }

        if (!isNaN(parseInt(value, 10))) {
            token.type = 'INT_CONST';
            token.value = parseInt(value, 10);
            token.xml = `<integerConstant>${value}</integerConstant>`;
        }

        return token;
    }

    private currentIndexIsUndefined(): boolean {
        return typeof this.currentTokenIndex === 'undefined';
    }
}
