import { JackKeyword, JackSymbol } from './defines';

export const KEYWORDS: string[] = [
    JackKeyword.CLASS,
    JackKeyword.CONSTRUCTOR,
    JackKeyword.FUNCTION,
    JackKeyword.METHOD,
    JackKeyword.FIELD,
    JackKeyword.STATIC,
    JackKeyword.VAR,
    JackKeyword.INT,
    JackKeyword.CHAR,
    JackKeyword.BOOLEAN,
    JackKeyword.VOID,
    JackKeyword.TRUE,
    JackKeyword.FALSE,
    JackKeyword.NULL,
    JackKeyword.THIS,
    JackKeyword.LET,
    JackKeyword.DO,
    JackKeyword.IF,
    JackKeyword.ELSE,
    JackKeyword.WHILE,
    JackKeyword.RETURN,
];

export const SYMBOLS: string[] = [
    JackSymbol.CURLY_BRACKET_OPEN,
    JackSymbol.CURLY_BRACKET_CLOSE,
    JackSymbol.BRACKET_OPEN,
    JackSymbol.BRACKET_CLOSE,
    JackSymbol.SQUARE_BRACKET_OPEN,
    JackSymbol.SQUARE_BRACKET_CLOSE,
    JackSymbol.DOT,
    JackSymbol.COMMA,
    JackSymbol.SEMICOLON,
    JackSymbol.PLUS,
    JackSymbol.MINUS,
    JackSymbol.MULTIPLY,
    JackSymbol.DIVIDE,
    JackSymbol.AND,
    JackSymbol.OR,
    JackSymbol.LT,
    JackSymbol.GT,
    JackSymbol.EQ,
    JackSymbol.NOT,
];

export const MARKUP_SYMBOLS_MAP: Map<string, string> = new Map([
    [JackSymbol.LT, '&lt;'],
    [JackSymbol.GT, '&gt;'],
    [JackSymbol.AND, '&amp;'],
]);

export const KEYWORD_CONSTANTS: JackKeyword[] = [
    JackKeyword.TRUE,
    JackKeyword.FALSE,
    JackKeyword.NULL,
    JackKeyword.THIS,
];

export const TYPES: JackKeyword[] = [JackKeyword.INT, JackKeyword.CHAR, JackKeyword.BOOLEAN];

export const SUBROUTINE_TYPES: JackKeyword[] = [JackKeyword.CONSTRUCTOR, JackKeyword.FUNCTION, JackKeyword.METHOD];

export const OPERATORS: JackSymbol[] = [
    JackSymbol.PLUS,
    JackSymbol.MINUS,
    JackSymbol.MULTIPLY,
    JackSymbol.DIVIDE,
    JackSymbol.AND,
    JackSymbol.OR,
    JackSymbol.LT,
    JackSymbol.GT,
    JackSymbol.EQ,
];

export const UNARY_OPERATORS: string[] = [JackSymbol.MINUS, JackSymbol.NOT];

export const TOKEN_SEPARATOR_REGEXP =
    /(?=[\s\{\}\(\)\[\]\.\,\;\+\-\*\/\&\>\<\=\~])|(?<=[\s\{\}\(\)\[\]\.\,\;\+\-\*\/\&\>\<\=\~])/g;

export const STRING_SEPARATOR_REGEXP = /(?=\".*\")|(?<=\".*\")/g;

export const INTEGER_MIN = 0;
export const INTEGER_MAX = 32767;

export const INDENT_SIZE = 4;
