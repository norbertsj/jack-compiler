type TokenType = 'KEYWORD' | 'SYMBOL' | 'IDENTIFIER' | 'INT_CONST' | 'STRING_CONST';

export default interface Token {
    type: TokenType;
    value: string | number;
    xml: string;
}
