import { KEYWORDS, SYMBOLS, TOKEN_SEPERATOR_REGEXP } from './defines';
import Token from './token';

const rawInput: string[] = `
/*
    .jack file
*/

/**
*    other comments
     hehe
****/

// compact code
constructor Game new() {let PLAYER_X=1;let board=Board.new();do init();return this;}
constructor _weirdClass55_a new() {do nothing();}

// normal code
method void init() {
    let gameInProgress = false;
    let gameIsDraw = false;
    let currentPlayer = PLAYER_O;
    let message = "Hello!";
    let interesting_variable99 = 1;

    return;
}
`.split('\n');

class Tokenizer {
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
            const rawTokens = line.split(TOKEN_SEPERATOR_REGEXP).filter((rt) => rt !== '' && rt !== ' ');
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

    public getCurrentToken(): Token | null {
        if (typeof this.currentTokenIndex !== 'undefined') {
            return this.tokens[this.currentTokenIndex];
        }

        return null;
    }

    public printTokens(): void {
        console.log(this.tokens);
    }
}

const tokenizer = new Tokenizer(rawInput);
tokenizer.printTokens();
