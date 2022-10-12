import { VMWriter } from './vm-writer';
import { OPERATORS, UNARY_OPERATORS } from '../constants';
import { ParseTree, ParseTreeNode } from '../parse-tree';
import {
    Command,
    IdentifierCategory,
    IdentifierContext,
    JackKeyword,
    JackSymbol,
    LexicalElement,
    MemorySegment,
    ParseTreeElement,
} from '../defines';
import { VariableData } from '../types';

export type SubroutineData = {
    returnType: string;
    locals: ParseTreeNode[];
    args: ParseTreeNode[];
};

export type ClassData = {
    name: string;
    vars: ParseTreeNode[];
    whileLoops: number;
    ifStatements: number;
};

const defaultSubroutineData: SubroutineData = {
    returnType: 'void',
    locals: [],
    args: [],
};

function debug(data: any): void {
    console.dir(data, { depth: null });
}

export class CodeGenerator {
    private readonly vmWriter: VMWriter;
    private classData: ClassData;
    private subroutineData = defaultSubroutineData;

    constructor(private readonly tree: ParseTree) {
        this.vmWriter = new VMWriter();
        this.classData = { name: this.findClassName(), vars: [], whileLoops: 0, ifStatements: 0 };
    }

    generate(): void {
        for (const node of this.tree.root.children) {
            if (node.value.type === ParseTreeElement.SUBROUTINE_DEC) {
                this.generateSubroutine(node);
                continue;
            }
        }
    }

    getOutput(): string[] {
        return this.vmWriter.getOutput();
    }

    private generateSubroutine(subroutine: ParseTreeNode): void {
        this.setSubroutineData(subroutine);

        const subroutineName = this.findSubroutineName(subroutine);
        const varData = this.findVariableData(subroutineName, subroutine);
        const body = this.findSubroutineBody(subroutine);

        this.vmWriter.writeFunction(`${this.classData.name}.${subroutineName}`, varData.nVars);
        this.generateSubroutineBody(body);

        this.clearSubroutineData();
        this.vmWriter.writeEmptyLine();
    }

    private generateSubroutineBody(subroutineBody: ParseTreeNode): void {
        for (const node of subroutineBody.children) {
            if (node.value.type === ParseTreeElement.STATEMENTS) {
                this.generateStatements(node);
                continue;
            }

            if (node.value.type === ParseTreeElement.SUBROUTINE_VAR_DEC) {
                this.setSubroutineLocalVars(node);
                continue;
            }
        }
    }

    private generateStatements(statements: ParseTreeNode): void {
        for (const node of statements.children) {
            switch (node.value.type) {
                case ParseTreeElement.DO:
                    this.generateDoStatement(node);
                    break;
                case ParseTreeElement.LET:
                    this.generateLetStatement(node);
                    break;
                case ParseTreeElement.IF:
                    this.generateIfStatement(node);
                    break;
                case ParseTreeElement.WHILE:
                    this.generateWhileStatement(node);
                    break;
                case ParseTreeElement.RETURN:
                    this.generateReturnStatement(node);
                    break;
                default:
                    break;
            }
        }
    }

    private generateLetStatement(statement: ParseTreeNode): void {
        const varDef = this.findVariableDefinition(statement);
        const varDec = this.findVariableDeclaration(<string>varDef.value.value);
        const expression = this.findExpression(statement);
        this.generateExpression(expression);
        this.vmWriter.writePop(<MemorySegment>varDec.value.props!.kind, <number>varDec.value.props!.varTableIndex);
    }

    private generateIfStatement(statement: ParseTreeNode): void {
        const conditionExpression = this.findExpression(statement);
        const endLabel = `IF.${this.classData.ifStatements}.END`;
        const elseLabel = `IF.${this.classData.ifStatements}.ELSE`;
        this.classData.ifStatements++;

        this.generateExpression(conditionExpression);
        this.vmWriter.writeArithmetic(Command.NOT);

        const elseStatement = this.findElseStatement(statement);
        this.vmWriter.writeIf(elseStatement ? elseLabel : endLabel);

        const statements = this.findStatements(statement);
        this.generateStatements(statements);

        if (elseStatement) {
            // if we have `else` block then we need this `goto` for if block itself (to avoid exec of `else` block)
            this.vmWriter.writeGoto(endLabel);

            this.vmWriter.writeLabel(elseLabel);
            this.generateElseStatement(elseStatement);
        }

        this.vmWriter.writeLabel(endLabel);
    }

    private generateElseStatement(statement: ParseTreeNode): void {
        const statements = this.findStatements(statement);
        this.generateStatements(statements);
    }

    private generateWhileStatement(statement: ParseTreeNode): void {
        const conditionExpression = this.findExpression(statement);
        const conditionLabel = `WHILE.${this.classData.whileLoops}.CONDITION`;
        const endLabel = `WHILE.${this.classData.whileLoops}.END`;
        this.classData.whileLoops++;

        this.vmWriter.writeLabel(conditionLabel);
        this.generateExpression(conditionExpression);
        this.vmWriter.writeArithmetic(Command.NOT);
        this.vmWriter.writeIf(endLabel);

        const statements = this.findStatements(statement);
        this.generateStatements(statements);

        this.vmWriter.writeGoto(conditionLabel);
        this.vmWriter.writeLabel(endLabel);
    }

    private generateDoStatement(statement: ParseTreeNode): void {
        let name = '';
        let nArgs = 0;

        for (const node of statement.children) {
            if (
                node.value.type === LexicalElement.IDENTIFIER ||
                (node.value.type === LexicalElement.SYMBOL && node.value.value === JackSymbol.DOT)
            ) {
                name += node.value.value;
                continue;
            }

            if (node.value.type === ParseTreeElement.EXPRESSION_LIST) {
                this.generateExpressionList(node);
                nArgs += node.children.length;
                continue;
            }
        }

        this.vmWriter.writeCall(name, nArgs);
    }

    private generateExpressionList(expressionList: ParseTreeNode): void {
        for (const node of expressionList.children) {
            this.generateExpression(node);
        }
    }

    private generateExpression(expression: ParseTreeNode): void {
        const ops: ParseTreeNode[] = [];
        for (const node of expression.children) {
            if (node.value.type === ParseTreeElement.TERM) {
                this.generateTerm(node);
                continue;
            }

            if (node.value.type === LexicalElement.SYMBOL && OPERATORS.includes(<JackSymbol>node.value.value)) {
                ops.push(node);
                continue;
            }
        }

        for (const op of ops) {
            this.generateOp(op);
        }
    }

    private generateTerm(term: ParseTreeNode): void {
        if (term.children.length === 1) {
            const child = term.children[0];

            if (child.value.type === LexicalElement.KEYWORD && child.value.value === JackKeyword.TRUE) {
                this.vmWriter.writePush(MemorySegment.CONSTANT, 1);
                this.vmWriter.writeArithmetic(Command.NEG);
                return;
            }

            if (
                child.value.type === LexicalElement.KEYWORD &&
                (child.value.value === JackKeyword.FALSE || child.value.value === JackKeyword.NULL)
            ) {
                this.vmWriter.writePush(MemorySegment.CONSTANT, 0);
                return;
            }

            if (child.value.type === LexicalElement.INTEGER) {
                this.vmWriter.writePush(MemorySegment.CONSTANT, <number>child.value.value);
                return;
            }

            if (
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.VARIABLE &&
                child.value.context === IdentifierContext.USAGE
            ) {
                this.vmWriter.writePush(
                    <MemorySegment>child.value.props!.kind,
                    <number>child.value.props!.varTableIndex
                );
                return;
            }
        }

        if (this.isExpressionTerm(term)) {
            const expression = this.findExpression(term);
            this.generateExpression(expression);
            return;
        }

        if (this.isUnaryOp(term)) {
            this.generateTerm(term.children[1]);
            this.generateOp(term.children[0], true);
            return;
        }

        // should implement proper subroutine call check..
        this.generateDoStatement(term);
    }

    private generateOp(op: ParseTreeNode, isUnary = false): void {
        if (op.value.value === JackSymbol.PLUS) {
            this.vmWriter.writeArithmetic(Command.ADD);
        }

        if (op.value.value === JackSymbol.MINUS) {
            if (isUnary) {
                this.vmWriter.writeArithmetic(Command.NEG);
                return;
            }

            this.vmWriter.writeArithmetic(Command.SUB);
        }

        if (op.value.value === JackSymbol.MULTIPLY) {
            this.vmWriter.writeCall('Math.multiply', 2);
        }

        if (op.value.value === JackSymbol.DIVIDE) {
            this.vmWriter.writeCall('Math.divide', 2);
        }

        if (op.value.value === JackSymbol.AND) {
            this.vmWriter.writeArithmetic(Command.AND);
        }

        if (op.value.value === JackSymbol.OR) {
            this.vmWriter.writeArithmetic(Command.OR);
        }

        if (op.value.value === JackSymbol.LT) {
            this.vmWriter.writeArithmetic(Command.LT);
        }

        if (op.value.value === JackSymbol.GT) {
            this.vmWriter.writeArithmetic(Command.GT);
        }

        if (op.value.value === JackSymbol.EQ) {
            this.vmWriter.writeArithmetic(Command.EQ);
        }

        if (op.value.value === JackSymbol.NOT) {
            this.vmWriter.writeArithmetic(Command.NOT);
        }
    }

    private generateReturnStatement(statement: ParseTreeNode): void {
        if (this.subroutineData.returnType === JackKeyword.VOID) {
            this.vmWriter.writePush(MemorySegment.CONSTANT, 0);
        } else {
            const expression = this.findExpression(statement);
            this.generateExpression(expression);
        }

        this.vmWriter.writeReturn();
    }

    private clearSubroutineData(): void {
        this.subroutineData = defaultSubroutineData;
    }

    //#region setters
    private setSubroutineLocalVars(varDec: ParseTreeNode): void {
        const vars = varDec.children.filter((child) => child.value.type === LexicalElement.IDENTIFIER);
        this.subroutineData.locals = [...this.subroutineData.locals, ...vars];
    }

    private setSubroutineArgs(subroutine: ParseTreeNode): void {
        const params = this.findSubroutineParams(subroutine);
        this.subroutineData.args = params.children.filter((child) => child.value.type === LexicalElement.IDENTIFIER);
    }

    private setSubroutineReturnType(subroutine: ParseTreeNode): void {
        this.subroutineData.returnType = this.findReturnType(subroutine);
    }

    private setSubroutineData(subroutine: ParseTreeNode): void {
        this.setSubroutineReturnType(subroutine);
        this.setSubroutineArgs(subroutine);
    }

    //#endregion

    //#region finders
    private findClassName(): string {
        const node = this.tree.root.children.find(
            (child) =>
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.CLASS &&
                child.value.context === IdentifierContext.USAGE
        );

        if (!node) {
            throw new Error('Could not find class declaration');
        }

        return <string>node.value.value;
    }

    private findVariableDeclaration(name: string): ParseTreeNode {
        const subLocal = this.subroutineData.locals.find((node) => node.value.value === name);
        const subArg = this.subroutineData.args.find((node) => node.value.value === name);
        const classVar = this.classData.vars.find((node) => node.value.value === name);

        const variable = subLocal || subArg || classVar;

        if (!variable) {
            throw new Error('Could not find variable');
        }

        return variable;
    }

    private findVariableDefinition(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find(
            (child) =>
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.VARIABLE &&
                child.value.context === IdentifierContext.DEFINITION
        );

        if (!node) {
            throw new Error('Could not find variable definition');
        }

        return node;
    }

    private findSubroutineParams(subroutine: ParseTreeNode): ParseTreeNode {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.PARAM_LIST);

        if (!node) {
            throw new Error('Could not find param list');
        }

        return node;
    }

    private findSubroutineBody(subroutine: ParseTreeNode): ParseTreeNode {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.SUBROUTINE_BODY);

        if (!node) {
            throw new Error('Could not find subroutine body');
        }

        return node;
    }

    private findSubroutineName(subroutine: ParseTreeNode): string {
        const node = subroutine.children.find(
            (child) =>
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.SUBROUTINE &&
                child.value.context === IdentifierContext.DECLARATION
        );

        if (!node) {
            throw new Error('Could not find subroutine declaration');
        }

        return <string>node.value.value;
    }

    private findVariableData(subroutineName: string, subroutine: ParseTreeNode): VariableData {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.VAR_DATA);

        if (!node) {
            throw new Error(`Could not find variable data for subroutine: ${subroutineName}`);
        }

        return <VariableData>node.value.props;
    }

    private findReturnType(subroutine: ParseTreeNode): string {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.RETURN_TYPE);

        if (!node) {
            throw new Error('Could not find subroutine return type');
        }

        return <string>node.value.value;
    }

    private findExpression(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find((child) => child.value.type === ParseTreeElement.EXPRESSION);
        if (!node) {
            throw new Error('Could not find expression');
        }

        return node;
    }

    private findExpressionList(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find((child) => child.value.type === ParseTreeElement.EXPRESSION_LIST);
        if (!node) {
            throw new Error('Could not find expression list');
        }

        return node;
    }

    private findStatements(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find((child) => child.value.type === ParseTreeElement.STATEMENTS);
        if (!node) {
            throw new Error('Could not find statements');
        }

        return node;
    }

    private findElseStatement(parent: ParseTreeNode): ParseTreeNode | null {
        const elseStatement = parent.children.find((child) => child.value.type === ParseTreeElement.ELSE);
        if (!elseStatement) {
            return null;
        }

        return elseStatement;
    }
    //#endregion

    //#region term
    private isUnaryOp(term: ParseTreeNode): boolean {
        if (term.children.length === 2) {
            const first = term.children[0];
            const second = term.children[1];
            return (
                first.value.type === LexicalElement.SYMBOL &&
                UNARY_OPERATORS.includes(<string>first.value.value) &&
                second.value.type === ParseTreeElement.TERM
            );
        }

        return false;
    }

    private isExpressionTerm(term: ParseTreeNode): boolean {
        if (term.children.length === 3) {
            const first = term.children[0];
            const second = term.children[1];
            const third = term.children[2];

            return (
                first.value.type === LexicalElement.SYMBOL &&
                first.value.value === JackSymbol.BRACKET_OPEN &&
                second.value.type === ParseTreeElement.EXPRESSION &&
                third.value.type === LexicalElement.SYMBOL &&
                third.value.value === JackSymbol.BRACKET_CLOSE
            );
        }

        return false;
    }
    //#endregion
}
