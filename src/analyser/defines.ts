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

export const TOKEN_SEPARATOR_REGEXP =
    /\s|(?=[\{|\}|\(|\)|\[|\]|\.|\,|\;|\+|\-|\*|\/|\&|\<|\>|\=|\~])|(?<=[\{|\}|\(|\)|\[|\]|\.|\,|\;|\+|\-|\*|\/|\&|\<|\>|\=|\~])/g;

export const INTEGER_MIN = 0;
export const INTEGER_MAX = 32767;
