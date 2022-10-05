import { LexicalElement } from './defines';

export type Token = {
    type: LexicalElement;
    value: string | number;
    xml: string;
};

export type VariableData = {
    nArgs: number;
    nVars: number;
};
