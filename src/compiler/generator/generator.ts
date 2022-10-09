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

        return node.value.value as string;
    }

    private generateSubroutine(subroutineNode: ParseTreeNode): void {
        this.setSubroutineData(subroutineNode);

        const subroutineName = this.findSubroutineName(subroutineNode);
        const varData = this.findVariableData(subroutineName, subroutineNode);
        const body = this.findSubroutineBody(subroutineNode);

        this.vmWriter.writeFunction(`${this.classData.name}.${subroutineName}`, varData.nVars);
        this.generateSubroutineBody(body);

        this.clearSubroutineData();
        this.vmWriter.writeEmptyLine();
    }

    private generateSubroutineBody(subroutineBodyNode: ParseTreeNode): void {
        for (const node of subroutineBodyNode.children) {
            if (node.value.type === ParseTreeElement.STATEMENTS) {
                this.generateStatements(node);
                continue;
            }

            if (node.value.type === ParseTreeElement.SUBROUTINE_VAR_DEC) {
                this.addSubroutineLocalVars(node);
                continue;
            }
        }
    }

    private addSubroutineLocalVars(varDecNode: ParseTreeNode): void {
        const vars = varDecNode.children.filter((node) => node.value.type === LexicalElement.IDENTIFIER);
        this.subroutineData.locals = [...this.subroutineData.locals, ...vars];
    }

    private setSubroutineArgs(subroutineNode: ParseTreeNode): void {
        const paramNode = this.findSubroutineParams(subroutineNode);
        this.subroutineData.args = paramNode.children.filter((node) => node.value.type === LexicalElement.IDENTIFIER);
    }

    private setSubroutineReturnType(subroutineNode: ParseTreeNode): void {
        this.subroutineData.returnType = this.findReturnType(subroutineNode);
    }

    private setSubroutineData(subroutineNode: ParseTreeNode): void {
        this.setSubroutineReturnType(subroutineNode);
        this.setSubroutineArgs(subroutineNode);
    }

    private clearSubroutineData(): void {
        this.subroutineData = defaultSubroutineData;
    }

    private findSubroutineLocalVar(name: string): ParseTreeNode | null {
        const varNode = this.subroutineData.locals.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findSubroutineArgVar(name: string): ParseTreeNode | null {
        const varNode = this.subroutineData.args.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findClassVar(name: string): ParseTreeNode | null {
        const varNode = this.classData.vars.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findVariable(name: string): ParseTreeNode | null {
        const subLocal = this.findSubroutineLocalVar(name);
        const subArg = this.findSubroutineArgVar(name);
        const classVar = this.findClassVar(name);

        return subLocal || subArg || classVar || null;
    }

    private generateStatements(statementsNode: ParseTreeNode): void {
        for (const node of statementsNode.children) {
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

    private generateLetStatement(statementNode: ParseTreeNode): void {
        // todo: deal with arrays (will need different solution)
        const varNode = statementNode.children.find(
            (node) =>
                node.value.type === LexicalElement.IDENTIFIER &&
                node.value.category === IdentifierCategory.VARIABLE &&
                node.value.context === IdentifierContext.USAGE
        );

        const varDecNode = this.findVariable(<string>varNode!.value.value);
        const expressionNode = statementNode.children.find((node) => node.value.type === ParseTreeElement.EXPRESSION);
        this.generateExpression(expressionNode!);
        this.vmWriter.writePop(
            <MemorySegment>varDecNode!.value.props!.kind,
            <number>varDecNode!.value.props!.varTableIndex
        );
    }

    private generateIfStatement(statementNode: ParseTreeNode): void {
        const conditionExpression = statementNode.children.find(
            (child) => child.value.type === ParseTreeElement.EXPRESSION
        );
        const endLabel = `IF.${this.classData.ifStatements}.END`;
        const elseLabel = `IF.${this.classData.ifStatements}.ELSE`;
        this.classData.ifStatements++;

        this.generateExpression(conditionExpression!);
        this.vmWriter.writeArithmetic(Command.NOT);

        const elseNode = statementNode.children.find((child) => child.value.type === ParseTreeElement.ELSE);
        this.vmWriter.writeIf(elseNode ? elseLabel : endLabel);

        const statements = statementNode.children.find((child) => child.value.type === ParseTreeElement.STATEMENTS);
        this.generateStatements(statements!);

        if (elseNode) {
            // if we have `else` block then we need this `goto` for if block itself (to avoid exec of `else` block)
            this.vmWriter.writeGoto(endLabel);

            this.vmWriter.writeLabel(elseLabel);
            this.generateElse(elseNode);
        }

        this.vmWriter.writeLabel(endLabel);
    }

    private generateElse(elseNode: ParseTreeNode): void {
        const statements = elseNode.children.find((child) => child.value.type === ParseTreeElement.STATEMENTS);
        this.generateStatements(statements!);
    }

    private generateWhileStatement(statementNode: ParseTreeNode): void {
        const conditionExpression = statementNode.children.find(
            (child) => child.value.type === ParseTreeElement.EXPRESSION
        ); // todo: look only between symbols ()
        const conditionLabel = `WHILE.${this.classData.whileLoops}.CONDITION`;
        const endLabel = `WHILE.${this.classData.whileLoops}.END`;
        this.classData.whileLoops++;

        this.vmWriter.writeLabel(conditionLabel);
        this.generateExpression(conditionExpression!);
        this.vmWriter.writeArithmetic(Command.NOT);
        this.vmWriter.writeIf(endLabel);

        const statementsNode = statementNode.children.find((child) => child.value.type === ParseTreeElement.STATEMENTS);
        this.generateStatements(statementsNode!);

        this.vmWriter.writeGoto(conditionLabel);
        this.vmWriter.writeLabel(endLabel);
    }

    private generateDoStatement(statementNode: ParseTreeNode): void {
        let name = '';
        let nArgs = 0;

        for (const node of statementNode.children) {
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

    private generateExpressionList(listNode: ParseTreeNode): void {
        for (const node of listNode.children) {
            this.generateExpression(node);
        }
    }

    private generateExpression(expressionNode: ParseTreeNode): void {
        const ops: ParseTreeNode[] = [];
        for (const node of expressionNode.children) {
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

    private generateTerm(termNode: ParseTreeNode): void {
        if (termNode.children.length === 1) {
            const child = termNode.children[0];

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

        if (this.isExpressionTerm(termNode)) {
            const expressionNode = termNode.children.find((node) => node.value.type === ParseTreeElement.EXPRESSION);
            this.generateExpression(expressionNode!);
            return;
        }

        if (this.isUnaryOp(termNode)) {
            this.generateTerm(termNode.children[1]);
            this.generateOp(termNode.children[0], true);
            return;
        }

        // should implement proper subroutine call check..
        this.generateDoStatement(termNode);
    }

    private generateOp(opNode: ParseTreeNode, isUnary = false): void {
        if (opNode.value.value === JackSymbol.PLUS) {
            this.vmWriter.writeArithmetic(Command.ADD);
        }

        if (opNode.value.value === JackSymbol.MINUS) {
            if (isUnary) {
                this.vmWriter.writeArithmetic(Command.NEG);
                return;
            }

            this.vmWriter.writeArithmetic(Command.SUB);
        }

        if (opNode.value.value === JackSymbol.MULTIPLY) {
            this.vmWriter.writeCall('Math.multiply', 2);
        }

        if (opNode.value.value === JackSymbol.DIVIDE) {
            this.vmWriter.writeCall('Math.divide', 2);
        }

        if (opNode.value.value === JackSymbol.AND) {
            this.vmWriter.writeArithmetic(Command.AND);
        }

        if (opNode.value.value === JackSymbol.OR) {
            this.vmWriter.writeArithmetic(Command.OR);
        }

        if (opNode.value.value === JackSymbol.LT) {
            this.vmWriter.writeArithmetic(Command.LT);
        }

        if (opNode.value.value === JackSymbol.GT) {
            this.vmWriter.writeArithmetic(Command.GT);
        }

        if (opNode.value.value === JackSymbol.EQ) {
            this.vmWriter.writeArithmetic(Command.EQ);
        }

        if (opNode.value.value === JackSymbol.NOT) {
            this.vmWriter.writeArithmetic(Command.NOT);
        }
    }

    private generateReturnStatement(statementNode: ParseTreeNode): void {
        if (this.subroutineData.returnType === JackKeyword.VOID) {
            this.vmWriter.writePush(MemorySegment.CONSTANT, 0);
        } else {
            const expression = statementNode.children.find((child) => child.value.type === ParseTreeElement.EXPRESSION);
            this.generateExpression(expression!);
        }

        this.vmWriter.writeReturn();
    }

    private findSubroutineParams(subroutineNode: ParseTreeNode): ParseTreeNode {
        const node = subroutineNode.children.find((child) => child.value.type === ParseTreeElement.PARAM_LIST);

        if (!node) {
            throw new Error('Could not find subroutine params');
        }

        return node;
    }

    private findSubroutineBody(subroutineNode: ParseTreeNode): ParseTreeNode {
        const node = subroutineNode.children.find((child) => child.value.type === ParseTreeElement.SUBROUTINE_BODY);

        if (!node) {
            throw new Error('Could not find subroutine body');
        }

        return node;
    }

    private findSubroutineName(subroutineNode: ParseTreeNode): string {
        const node = subroutineNode.children.find(
            (child) =>
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.SUBROUTINE &&
                child.value.context === IdentifierContext.DECLARATION
        );

        if (!node) {
            throw new Error('Could not find subroutine declaration');
        }

        return node.value.value as string;
    }

    private findVariableData(subroutineName: string, subroutineNode: ParseTreeNode): VariableData {
        const node = subroutineNode.children.find((child) => child.value.type === ParseTreeElement.VAR_DATA);

        if (!node) {
            throw new Error(`Could not find variable data for subroutine: ${subroutineName}`);
        }

        return <VariableData>node.value.props;
    }

    private findReturnType(subroutineNode: ParseTreeNode): string {
        const node = subroutineNode.children.find((child) => child.value.type === ParseTreeElement.RETURN_TYPE);

        if (!node) {
            throw new Error('Could not find subroutine return type');
        }

        return node.value.value as string;
    }

    // todo: add generic child finders like child.value.type === ParseTreeElement.EXPRESSION and so on

    //#region term
    private isUnaryOp(termNode: ParseTreeNode): boolean {
        if (termNode.children.length === 2) {
            const first = termNode.children[0];
            const second = termNode.children[1];
            return (
                first.value.type === LexicalElement.SYMBOL &&
                UNARY_OPERATORS.includes(first.value.value as string) &&
                second.value.type === ParseTreeElement.TERM
            );
        }

        return false;
    }

    private isExpressionTerm(termNode: ParseTreeNode): boolean {
        if (termNode.children.length === 3) {
            const first = termNode.children[0];
            const second = termNode.children[1];
            const third = termNode.children[2];

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
