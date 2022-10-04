import { Tree, Node } from '../analyser/tree';
import { VariableData } from '../analyser/variable-table';
import { VMWriter } from './vm-writer';
import { OPERATORS, UNARY_OPERATORS } from '../analyser/constants';

type SubroutineData = {
    returnType: string;
    locals: Node[];
    args: Node[];
};

const defaultSubroutineData: SubroutineData = {
    returnType: 'void',
    locals: [],
    args: [],
};

type ClassData = {
    name: string;
    vars: Node[];
    whileLoops: number;
    ifStatements: number;
};

function debug(data: any) {
    console.dir(data, { depth: null });
}

export class CodeGenerator {
    private readonly vmWriter: VMWriter;
    private classData: ClassData;
    private subroutineData = defaultSubroutineData;

    constructor(private readonly tree: Tree) {
        this.vmWriter = new VMWriter();
        this.classData = { name: this.findClassName(), vars: [], whileLoops: 0, ifStatements: 0 };
    }

    generate() {
        for (const node of this.tree.root.children) {
            if (node.value.type === 'SUBROUTINE_DEC') {
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
                child.value.type === 'IDENTIFIER' &&
                child.value.category === 'class' &&
                child.value.context === 'declaration'
        );

        if (!node) {
            throw new Error('Could not find class declaration');
        }

        return node.value.value as string;
    }

    private generateSubroutine(subroutineNode: Node) {
        this.setSubroutineData(subroutineNode);

        const subroutineName = this.findSubroutineName(subroutineNode);
        const varData = this.findVariableData(subroutineName, subroutineNode);
        const body = this.findSubroutineBody(subroutineNode);

        this.vmWriter.writeFunction(`${this.classData.name}.${subroutineName}`, varData.nVars);
        this.generateSubroutineBody(body);

        this.clearSubroutineData();
        this.vmWriter.writeEmptyLine();
    }

    private generateSubroutineBody(subroutineBodyNode: Node) {
        for (const node of subroutineBodyNode.children) {
            if (node.value.type === 'STATEMENTS') {
                this.generateStatements(node);
                continue;
            }

            if (node.value.type === 'SUBROUTINE_VAR_DEC') {
                this.addSubroutineLocalVars(node);
                continue;
            }
        }
    }

    private addSubroutineLocalVars(varDecNode: Node) {
        const vars = varDecNode.children.filter((node) => node.value.type === 'IDENTIFIER');
        this.subroutineData.locals = [...this.subroutineData.locals, ...vars];
    }

    private setSubroutineArgs(subroutineNode: Node) {
        const paramNode = this.findSubroutineParams(subroutineNode);
        this.subroutineData.args = paramNode.children.filter((node) => node.value.type === 'IDENTIFIER');
    }

    private setSubroutineReturnType(subroutineNode: Node) {
        this.subroutineData.returnType = this.findReturnType(subroutineNode);
    }

    private setSubroutineData(subroutineNode: Node) {
        this.setSubroutineReturnType(subroutineNode);
        this.setSubroutineArgs(subroutineNode);
    }

    private clearSubroutineData() {
        this.subroutineData = defaultSubroutineData;
    }

    private findSubroutineLocalVar(name: string): Node | null {
        const varNode = this.subroutineData.locals.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findSubroutineArgVar(name: string): Node | null {
        const varNode = this.subroutineData.args.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findClassVar(name: string): Node | null {
        const varNode = this.classData.vars.find((node) => node.value.value === name);
        if (!varNode) {
            return null;
        }

        return varNode;
    }

    private findVariable(name: string): Node | null {
        const subLocal = this.findSubroutineLocalVar(name);
        const subArg = this.findSubroutineArgVar(name);
        const classVar = this.findClassVar(name);

        return subLocal || subArg || classVar || null;
    }

    private generateStatements(statementsNode: Node) {
        for (const node of statementsNode.children) {
            switch (node.value.type) {
                case 'DO':
                    this.generateDoStatement(node);
                    break;
                case 'LET':
                    this.generateLetStatement(node);
                    break;
                case 'IF':
                    this.generateIfStatement(node);
                    break;
                case 'WHILE':
                    this.generateWhileStatement(node);
                    break;
                case 'RETURN':
                    this.generateReturnStatement(node);
                    break;
                default:
                    break;
            }
        }
    }

    private generateLetStatement(statementNode: Node) {
        // todo: deal with arrays (will need different solution)
        const varNode = statementNode.children.find(
            (node) =>
                node.value.type === 'IDENTIFIER' &&
                node.value.category === 'variable' &&
                node.value.context === 'definition'
        );
        const varDecNode = this.findVariable(varNode.value.value as string);

        const expressionNode = statementNode.children.find((node) => node.value.type === 'EXPRESSION');
        this.generateExpression(expressionNode);
        this.vmWriter.writePop(varDecNode.value.props.kind as string, varDecNode.value.props.varTableIndex as number);
    }

    private generateIfStatement(statementNode: Node) {
        const conditionExpression = statementNode.children.find((child) => child.value.type === 'EXPRESSION');
        const endLabel = `IF.${this.classData.ifStatements}.END`;
        const elseLabel = `IF.${this.classData.ifStatements}.ELSE`;
        this.classData.ifStatements++;

        this.generateExpression(conditionExpression);
        this.vmWriter.writeArithmetic('not');

        const elseNode = statementNode.children.find((child) => child.value.type === 'ELSE');
        this.vmWriter.writeIf(elseNode ? elseLabel : endLabel);

        const statements = statementNode.children.find((child) => child.value.type === 'STATEMENTS');
        this.generateStatements(statements);

        if (elseNode) {
            // if we have `else` block then we need this `goto` for if block itself (to avoid exec of `else` block)
            this.vmWriter.writeGoto(endLabel);

            this.vmWriter.writeLabel(elseLabel);
            this.generateElse(elseNode);
        }

        this.vmWriter.writeLabel(endLabel);
    }

    private generateElse(elseNode: Node) {
        const statements = elseNode.children.find((child) => child.value.type === 'STATEMENTS');
        this.generateStatements(statements);
    }

    private generateWhileStatement(statementNode: Node) {
        const conditionExpression = statementNode.children.find((child) => child.value.type === 'EXPRESSION'); // todo: look only between symbols ()
        const conditionLabel = `WHILE.${this.classData.whileLoops}.CONDITION`;
        const endLabel = `WHILE.${this.classData.whileLoops}.END`;
        this.classData.whileLoops++;

        this.vmWriter.writeLabel(conditionLabel);
        this.generateExpression(conditionExpression);
        this.vmWriter.writeArithmetic('not');
        this.vmWriter.writeIf(endLabel);

        const statementsNode = statementNode.children.find((child) => child.value.type === 'STATEMENTS');
        this.generateStatements(statementsNode);

        this.vmWriter.writeGoto(conditionLabel);
        this.vmWriter.writeLabel(endLabel);
    }

    private generateDoStatement(statementNode: Node) {
        let name = '';
        let nArgs = 0;

        for (const node of statementNode.children) {
            if (node.value.type === 'IDENTIFIER' || (node.value.type === 'SYMBOL' && node.value.value === '.')) {
                name += node.value.value;
                continue;
            }

            if (node.value.type === 'EXPRESSION_LIST') {
                this.generateExpressionList(node);
                nArgs += node.children.length;
                continue;
            }
        }

        this.vmWriter.writeCall(name, nArgs);
    }

    private generateExpressionList(listNode: Node) {
        for (const node of listNode.children) {
            this.generateExpression(node);
        }
    }

    private generateExpression(expressionNode: Node) {
        const ops: Node[] = [];
        for (const node of expressionNode.children) {
            if (node.value.type === 'TERM') {
                this.generateTerm(node);
                continue;
            }

            if (node.value.type === 'SYMBOL' && OPERATORS.includes(node.value.value as string)) {
                ops.push(node);
                continue;
            }
        }

        for (const op of ops) {
            this.generateOp(op);
        }
    }

    private generateTerm(termNode: Node) {
        if (termNode.children.length === 1) {
            const child = termNode.children[0];

            if (child.value.type === 'KEYWORD' && child.value.value === 'true') {
                this.vmWriter.writePush('constant', 1);
                this.vmWriter.writeArithmetic('neg');
                return;
            }

            if (child.value.type === 'KEYWORD' && (child.value.value === 'false' || child.value.value === 'null')) {
                this.vmWriter.writePush('constant', 0);
                return;
            }

            if (child.value.type === 'INT_CONST') {
                this.vmWriter.writePush('constant', child.value.value as number);
                return;
            }

            if (
                child.value.type === 'IDENTIFIER' &&
                child.value.category === 'variable' &&
                child.value.context === 'usage'
            ) {
                this.vmWriter.writePush(child.value.props.kind as string, child.value.props.varTableIndex as number);
                return;
            }
        }

        if (this.isExpressionTerm(termNode)) {
            const expressionNode = termNode.children.find((node) => node.value.type === 'EXPRESSION');
            this.generateExpression(expressionNode);
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

    private generateOp(opNode: Node, isUnary: boolean = false) {
        if (opNode.value.value === '+') {
            this.vmWriter.writeArithmetic('add');
        }

        if (opNode.value.value === '-') {
            if (isUnary) {
                this.vmWriter.writeArithmetic('neg');
                return;
            }

            this.vmWriter.writeArithmetic('sub');
        }

        if (opNode.value.value === '*') {
            this.vmWriter.writeCall('Math.multiply', 2);
        }

        if (opNode.value.value === '/') {
            this.vmWriter.writeCall('Math.divide', 2);
        }

        if (opNode.value.value === '&') {
            this.vmWriter.writeArithmetic('and');
        }

        if (opNode.value.value === '|') {
            this.vmWriter.writeArithmetic('or');
        }

        if (opNode.value.value === '<') {
            this.vmWriter.writeArithmetic('lt');
        }

        if (opNode.value.value === '>') {
            this.vmWriter.writeArithmetic('gt');
        }

        if (opNode.value.value === '=') {
            this.vmWriter.writeArithmetic('eq');
        }

        if (opNode.value.value === '~') {
            this.vmWriter.writeArithmetic('not');
        }
    }

    private generateReturnStatement(statementNode: Node) {
        if (this.subroutineData.returnType === 'void') {
            this.vmWriter.writePush('constant', 0);
        } else {
            const expression = statementNode.children.find((child) => child.value.type === 'EXPRESSION');
            this.generateExpression(expression);
        }

        this.vmWriter.writeReturn();
    }

    private findSubroutineParams(subroutineNode: Node): Node {
        const node = subroutineNode.children.find((child) => child.value.type === 'PARAM_LIST');

        if (!node) {
            throw new Error('Could not find subroutine params');
        }

        return node;
    }

    private findSubroutineBody(subroutineNode: Node): Node {
        const node = subroutineNode.children.find((child) => child.value.type === 'SUBROUTINE_BODY');

        if (!node) {
            throw new Error('Could not find subroutine body');
        }

        return node;
    }

    private findSubroutineName(subroutineNode: Node): string {
        const node = subroutineNode.children.find(
            (child) =>
                child.value.type === 'IDENTIFIER' &&
                child.value.category === 'subroutine' &&
                child.value.context === 'declaration'
        );

        if (!node) {
            throw new Error('Could not find subroutine declaration');
        }

        return node.value.value as string;
    }

    private findVariableData(subroutineName: string, subroutineNode: Node): VariableData {
        const node = subroutineNode.children.find((child) => child.value.type === 'VAR_DATA');

        if (!node) {
            throw new Error(`Could not find variable data for subroutine: ${subroutineName}`);
        }

        return node.value.props as VariableData;
    }

    private findReturnType(subroutineNode: Node): string {
        const node = subroutineNode.children.find((child) => child.value.type === 'RETURN_TYPE');

        if (!node) {
            throw new Error('Could not find subroutine return type');
        }

        return node.value.value as string;
    }

    // todo: add generic child finders like child.value.type === 'EXPRESSION' and so on

    //#region term
    private isUnaryOp(termNode: Node): boolean {
        if (termNode.children.length === 2) {
            const first = termNode.children[0];
            const second = termNode.children[1];
            return (
                first.value.type === 'SYMBOL' &&
                UNARY_OPERATORS.includes(first.value.value as string) &&
                second.value.type === 'TERM'
            );
        }

        return false;
    }

    private isExpressionTerm(termNode: Node): boolean {
        if (termNode.children.length === 3) {
            const first = termNode.children[0];
            const second = termNode.children[1];
            const third = termNode.children[2];

            return (
                first.value.type === 'SYMBOL' &&
                first.value.value === '(' &&
                second.value.type === 'EXPRESSION' &&
                third.value.type === 'SYMBOL' &&
                third.value.value === ')'
            );
        }

        return false;
    }
    //#endregion
}
