import { Token } from './token';
import { TYPES, INTEGER_MIN, INTEGER_MAX } from './constants';

export class Validator {
    static validateIdentifier(token: Token): void {
        if (token.type !== 'IDENTIFIER') {
            Validator.throwError('Identifier', token);
        }
    }

    static validateKeyword(token: Token, keyword: string) {
        if (token.type !== 'KEYWORD' || token.value !== keyword) {
            Validator.throwError(`Keyword "${keyword}"`, token);
        }
    }

    static validateKeywords(token: Token, keywords: string[]): void {
        if (token.type !== 'KEYWORD' || !keywords.includes(token.value as string)) {
            Validator.throwError(`Keyword ${keywords.map((kw) => `"${kw}"`).join(', ')}`, token);
        }
    }

    static validateType(token: Token, additional?: string[]): void {
        let types = [...TYPES];

        if (additional?.length > 0) {
            types = [...types, ...additional];
        }

        if ((token.type === 'KEYWORD' && types.includes(token.value as string)) || token.type === 'IDENTIFIER') {
            return;
        }

        Validator.throwError(`Keyword ${types.map((t) => `"${t}"`).join()} or className identifier`, token);
    }

    static validateSubroutineReturnType(token: Token): void {
        this.validateType(token, ['void']);
    }

    static validateSymbol(token: Token, symbol: string): void {
        if (token.type !== 'SYMBOL' || token.value !== symbol) {
            Validator.throwError(`Symbol "${symbol}"`, token);
        }
    }

    static validateSymbols(token: Token, symbols: string[]): void {
        if (token.type !== 'SYMBOL' || !symbols.includes(token.value as string)) {
            Validator.throwError(`Symbol ${symbols.map((s) => `"${s}"`).join(', ')}`, token);
        }
    }

    static validateIntegerValue(token: Token): void {
        const intVal = parseInt(token.value as string, 10);

        if (token.type !== 'INT_CONST' || isNaN(intVal) || intVal < INTEGER_MIN || intVal > INTEGER_MAX) {
            Validator.throwError(`Integer between ${INTEGER_MIN} and ${INTEGER_MAX}`, token);
        }
    }

    private static throwError(expected: string, token: Token): void {
        throw new Error(`${expected} expected, got ${token.type} "${token.value}" instead`);
    }
}
