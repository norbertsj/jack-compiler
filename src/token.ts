type TokenType = 'KEYWORD' | 'SYMBOL' | 'IDENTIFIER' | 'INT_CONST' | 'STRING_CONST';

export interface Token {
    type: TokenType;
    value: string | number;
    xml: string;
}
