import { KEYWORDS, SYMBOLS, TOKEN_SEPARATOR_REGEXP } from './defines';
import Token from './token';

export default class Tokenizer {
    private readonly tokens: Token[];
    private currentTokenIndex: number;

    public constructor(input: string[]) {
        this.tokens = this.tokenize(this.removeComments(input));
    }

    private removeComments(input: string[]): string[] {
        // joining the input lines and applying regexp to multiline string
        return input
            .join('\n')
            .replace(/\/+\*([\s\S]*?)\*\//gm, '')
            .replace(/\/+.*$/gm, '')
            .trim()
            .split('\n')
            .filter((line) => line.length > 0);
    }

    private tokenize(input: string[]): Token[] {
        let tokens: Token[] = [];

        for (const line of input) {
            const rawTokens = line.split(TOKEN_SEPARATOR_REGEXP).filter((rt) => rt !== '' && rt !== ' ');
            const generatedTokens = rawTokens.map((t) => this.generateToken(t));
            tokens = [...tokens, ...generatedTokens];
        }

        return tokens;
    }

    private generateToken(input: string): Token {
        const token: Token = {
            type: null,
            value: input,
            xml: null,
        };

        if (KEYWORDS.includes(input)) {
            token.type = 'KEYWORD';
            token.xml = `<keyword>${input}</keyword>`;
        } else if (SYMBOLS.includes(input)) {
            token.type = 'SYMBOL';
            token.xml = `<symbol>${input}</symbol>`;
        } else if (!isNaN(parseInt(input, 10))) {
            token.type = 'INT_CONST';
            token.value = parseInt(input, 10);
            token.xml = `<integerConstant>${input}</integerConstant>`;
        } else if (input.startsWith('"') && input.endsWith('"')) {
            token.type = 'STRING_CONST';
            token.value = input.replace(/\"/g, '');
            token.xml = `<stringConstant>${input.replace(/\"/g, '')}</stringConstant>`;
        } else {
            token.type = 'IDENTIFIER';
            token.xml = `<identifier>${input}</identifier>`;
        }

        return token;
    }

    public hasMoreTokens(): boolean {
        if (typeof this.currentTokenIndex === 'undefined') {
            return true;
        }

        if (this.currentTokenIndex < this.tokens.length - 1) {
            return true;
        }

        return false;
    }

    public advance(): void {
        if (this.hasMoreTokens()) {
            if (typeof this.currentTokenIndex === 'undefined') {
                this.currentTokenIndex = 0;
            } else {
                this.currentTokenIndex += 1;
            }
        }
    }

    public look(): Token | null {
        if (typeof this.currentTokenIndex !== 'undefined') {
            return this.tokens[this.currentTokenIndex];
        }

        return null;
    }

    public lookAhead() {
        if (this.hasMoreTokens()) {
            return this.tokens[this.currentTokenIndex + 1];
        }

        return null;
    }

    public printTokens(): void {
        console.log(this.tokens);
    }

    public printTokensXML(): void {
        console.log(this.tokens.map((t) => t.xml));
    }
}
