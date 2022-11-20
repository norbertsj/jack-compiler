import { LexicalElement } from './defines';

export type Token = {
    type: LexicalElement;
    value: string | number;
    xml: string;
    fileName: string;
    lineNumber: number;
};

export type NumberedInput = {
    line: string;
    lineNumber: number;
};

export type VariableData = {
    nArgs: number;
    nVars: number;
};
