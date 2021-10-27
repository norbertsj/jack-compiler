import Token from './token';
import { TYPES } from './defines';

export default class Validator {
    public static validateIdentifier(token: Token): void {
        if (token.type !== 'IDENTIFIER') {
            Validator.throwError('Identifier', token);
        }
    }

    public static validateKeyword(token: Token, keyword: string) {
        if (token.type !== 'KEYWORD' && token.value !== keyword) {
            Validator.throwError(`Keyword "${keyword}"`, token);
        }
    }

    public static validateKeywords(token: Token, keywords: string[]): void {
        if (token.type !== 'KEYWORD' && !keywords.includes(token.value.toString())) {
            Validator.throwError(`Keyword ${keywords.map((kw) => `"${kw}"`).join(', ')}`, token);
        }
    }

    public static validateType(token: Token, additional?: string[]): void {
        let types = [...TYPES];

        if (additional && additional.length > 0) {
            types = [...types, ...additional];
        }

        if (token.type !== 'KEYWORD' && !types.includes(token.value.toString()) && token.type !== 'IDENTIFIER') {
            Validator.throwError(`Keyword ${types.map((t) => `"${t}"`).join()} or className identifier`, token);
        }
    }

    public static validateSubroutineReturnType(token: Token): void {
        this.validateType(token, ['void']);
    }

    public static validateSymbol(token: Token, symbol: string) {
        if (token.type !== 'SYMBOL' && token.value !== symbol) {
            Validator.throwError(`Symbol "${symbol}"`, token);
        }
    }

    private static throwError(expected: string, token: Token): void {
        throw new Error(`${expected} expected, got ${token.type} "${token.value}" instead`);
    }
}
