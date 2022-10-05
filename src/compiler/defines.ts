export enum JackKeyword {
    CLASS = 'class',
    CONSTRUCTOR = 'constructor',
    FUNCTION = 'function',
    METHOD = 'method',
    FIELD = 'field',
    STATIC = 'static',
    VAR = 'var',
    INT = 'int',
    CHAR = 'char',
    BOOLEAN = 'boolean',
    VOID = 'void',
    TRUE = 'true',
    FALSE = 'false',
    NULL = 'null',
    THIS = 'this',
    LET = 'let',
    DO = 'do',
    IF = 'if',
    ELSE = 'else',
    WHILE = 'while',
    RETURN = 'return',
}

export enum JackSymbol {
    CURLY_BRACKET_OPEN = '{',
    CURLY_BRACKET_CLOSE = '}',
    BRACKET_OPEN = '(',
    BRACKET_CLOSE = ')',
    SQUARE_BRACKET_OPEN = '[',
    SQUARE_BRACKET_CLOSE = ']',
    DOT = '.',
    COMMA = ',',
    SEMICOLON = ';',
    PLUS = '+',
    MINUS = '-',
    MULTIPLY = '*',
    DIVIDE = '/',
    AND = '&',
    OR = '|',
    LT = '<',
    GT = '>',
    EQ = '=',
    NOT = '~',
}

export enum IdentifierCategory {
    VARIABLE = 'variable',
    CLASS = 'class',
    SUBROUTINE = 'subroutine',
}

export enum IdentifierContext {
    DECLARATION = 'declaration',
    DEFINITION = 'definition',
    USAGE = 'usage',
}

export enum VariableKind {
    LOCAL = 'local',
    ARGUMENT = 'argument',
    FIELD = 'field',
    STATIC = 'static',
}

export enum LexicalElement {
    KEYWORD = 'KEYWORD',
    SYMBOL = 'SYMBOL',
    IDENTIFIER = 'IDENTIFIER',
    INTEGER = 'INTEGER',
    STRING = 'STRING',
}

export enum ParseTreeElement {
    RETURN = 'RETURN',
    RETURN_TYPE = 'RETURN_TYPE',
    SUBROUTINE_DEC = 'SUBROUTINE_DEC',
    SUBROUTINE_BODY = 'SUBROUTINE_BODY',
    SUBROUTINE_VAR_DEC = 'SUBROUTINE_VAR_DEC',
    PARAM_LIST = 'PARAM_LIST',
    CLASS_VAR_DEC = 'CLASS_VAR_DEC',
    STATEMENTS = 'STATEMENTS',
    DO = 'DO',
    LET = 'LET',
    IF = 'IF',
    ELSE = 'ELSE',
    WHILE = 'WHILE',
    EXPRESSION = 'EXPRESSION',
    EXPRESSION_LIST = 'EXPRESSION_LIST',
    TERM = 'TERM',
    VAR_DATA = 'VAR_DATA',
}

export enum MemorySegment {
    LOCAL = 'local',
    ARGUMENT = 'argument',
    THIS = 'this',
    THAT = 'that',
    CONSTANT = 'constant',
    STATIC = 'static',
    POINTER = 'pointer',
    TEMP = 'temp',
}

export enum Command {
    ADD = 'add',
    SUB = 'sub',
    NEG = 'neg',
    EQ = 'eq',
    GT = 'gt',
    LT = 'lt',
    AND = 'and',
    OR = 'or',
    NOT = 'not',
}
