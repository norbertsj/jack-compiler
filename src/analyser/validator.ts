import Token from './token';

export default class Validator {
    public static validateClassKeyword(token: Token): void {
        if (token.type !== 'KEYWORD' && token.value !== 'class') {
            Validator.throwError('Keyword "class"', token);
        }
    }

    public static validateClassVarScope(token: Token): void {
        if (token.type !== 'KEYWORD' && !['static', 'field'].includes(token.value.toString())) {
            Validator.throwError('Keyword "static" or "field"', token);
        }
    }

    public static validateSubroutineVarScope(token: Token): void {
        if (token.type !== 'KEYWORD' && token.value.toString() !== 'var') {
            Validator.throwError('Keyword "var"', token);
        }
    }

    public static validateSubroutineType(token: Token): void {
        if (token.type !== 'KEYWORD' && !['constructor', 'function', 'method'].includes(token.value.toString())) {
            Validator.throwError('Keyword "constructor", "function" or "method"', token);
        }
    }

    public static validateType(token: Token, additional?: string[]): void {
        let types = ['int', 'char', 'boolean'];

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

    public static validateIdentifier(token: Token): void {
        if (token.type !== 'IDENTIFIER') {
            Validator.throwError('Identifier', token);
        }
    }

    public static validateBlockBracketsOpen(token: Token): void {
        if (token.type !== 'SYMBOL' && token.value !== '{') {
            Validator.throwError('Symbol "{"', token);
        }
    }

    public static validateBlockBracketsClose(token: Token): void {
        if (token.type !== 'SYMBOL' && token.value !== '}') {
            Validator.throwError('Symbol "}"', token);
        }
    }

    public static validateBracketsOpen(token: Token): void {
        if (token.type !== 'SYMBOL' && token.value !== '(') {
            Validator.throwError('Symbol "("', token);
        }
    }

    public static validateBracketsClose(token: Token): void {
        if (token.type !== 'SYMBOL' && token.value !== ')') {
            Validator.throwError('Symbol ")"', token);
        }
    }

    public static validateSemicolon(token: Token): void {
        if (token.type !== 'SYMBOL' && token.value !== ';') {
            Validator.throwError('Symbol ";"', token);
        }
    }

    private static throwError(expected: string, token: Token): void {
        throw new Error(`${expected} expected, got ${token.type} "${token.value}" instead`);
    }
}
