export const KEYWORDS: string[] = [
    'class',
    'constructor',
    'function',
    'method',
    'field',
    'static',
    'var',
    'int',
    'char',
    'boolean',
    'void',
    'true',
    'false',
    'null',
    'this',
    'let',
    'do',
    'if',
    'else',
    'while',
    'return',
];

export const SYMBOLS: string[] = [
    '{',
    '}',
    '(',
    ')',
    '[',
    ']',
    '.',
    ',',
    ';',
    '+',
    '-',
    '*',
    '/',
    '&',
    '|',
    '<',
    '>',
    '=',
    '~',
];

export const MARKUP_SYMBOLS_MAP: Map<string, string> = new Map([
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['&', '&amp;'],
]);

export const KEYWORD_CONSTANTS: string[] = ['true', 'false', 'null', 'this'];

export const TYPES: string[] = ['int', 'char', 'boolean'];

export const OPERATORS: string[] = ['+', '-', '*', '/', '&', '|', '<', '>', '='];

export const UNARY_OPERATORS: string[] = ['-', '~'];

export const TOKEN_SEPARATOR_REGEXP =
    /(?=[\{|\}|\(|\)|\[|\]|\.|\,|\;|\+|\-|\*|\/|\&|\<|\>|\=|\~])|(?<=[\{|\}|\(|\)|\[|\]|\.|\,|\;|\+|\-|\*|\/|\&|\<|\>|\=|\~])|[\s](?=(?:[^"]*"[^"]*")*[^"]*$)/g;

export const INTEGER_MIN = 0;
export const INTEGER_MAX = 32767;
