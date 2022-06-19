export type VariableKind = 'local' | 'argument' | 'field' | 'static';

export interface VariableInput {
    name: string;
    type: string;
    kind: VariableKind;
}

export interface Variable extends VariableInput {
    index: number;
}

export class VariableTable {
    private variables: Variable[] = [];

    add(variable: VariableInput): Variable {
        this.checkDuplicate(variable);
        const index = this.kindCount(variable.kind);
        const newVar = { ...variable, index };
        this.variables.push(newVar);
        return newVar;
    }

    find(name: string): Variable | null {
        const variable = this.variables.find((v) => v.name === name);
        if (!variable) {
            return null;
        }

        return variable;
    }

    reset(): void {
        this.variables = [];
    }

    private kindCount(kind: VariableKind): number {
        return this.variables.filter((v) => v.kind === kind).length;
    }

    private checkDuplicate(variable: VariableInput): void {
        const index = this.variables.findIndex((v) => v.name === variable.name);
        if (index !== -1) {
            throw new Error(`Duplicate ${variable.kind} variable identifier: ${variable.type} ${variable.name}`);
        }
    }
}
