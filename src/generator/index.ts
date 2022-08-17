import { Tree, Node } from '../analyser/tree';
import { VMWriter } from './vm-writer';

type VariableData = {
    nArgs: number;
    nVars: number;
};

export class CodeGenerator {
    private readonly vmWriter: VMWriter;
    private readonly className: string;
    private currentSubroutineReturnType = 'void';

    constructor(private readonly tree: Tree) {
        this.vmWriter = new VMWriter();
        this.className = this.findClassName();
    }

    generate() {
        for (const node of this.tree.root.children) {
            if (node.value.type === 'subroutineDec') {
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
                child.value.type === 'identifier' &&
                child.value.category === 'class' &&
                child.value.context === 'declaration'
        );

        if (!node) {
            throw new Error('Could not find class declaration');
        }

        return node.value.value as string;
    }

    private generateSubroutine(subroutineNode: Node) {
        const subroutineName = this.findSubroutineName(subroutineNode);
        const varData = this.findVariableData(subroutineName, subroutineNode);
        this.currentSubroutineReturnType = this.findReturnType(subroutineNode);
        this.vmWriter.writeFunction(`${this.className}.${subroutineName}`, varData.nVars);
        const body = this.findSubroutineBody(subroutineNode);
        this.generateSubroutineBody(body);
    }

    private generateSubroutineBody(subroutineBodyNode: Node) {
        for (const node of subroutineBodyNode.children) {
            if (node.value.type === 'statements') {
                this.generateStatements(node);
                continue;
            }
        }
    }

    private generateStatements(statementsNode: Node) {
        for (const node of statementsNode.children) {
            if (node.value.type === 'doStatement') {
                this.generateDoStatement(node);
                continue;
            }

            if (node.value.type === 'returnStatement') {
                this.generateReturnStatement(node);
                continue;
            }
        }
    }

    private generateDoStatement(statementNode: Node) {
        let name = '';
        let nArgs = 0;

        for (const node of statementNode.children) {
            if (node.value.type === 'identifier' || (node.value.type === 'symbol' && node.value.value === '.')) {
                name += node.value.value;
                continue;
            }

            if (node.value.type === 'expressionList') {
                this.generateExpressionList(node);
                nArgs++;
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
        const { ops, terms } = this.getExpressionData(expressionNode);

        for (const term of terms) {
            this.generateTerm(term);
        }

        for (const op of ops) {
            this.generateOp(op);
        }
    }

    private getExpressionData(expressionNode: Node): { ops: Node[]; terms: Node[] } {
        let ops: Node[] = [];
        let terms: Node[] = [];

        for (const node of expressionNode.children) {
            if (node.value.type === 'symbol') {
                ops.push(node);
                continue;
            }

            if (node.value.type === 'term') {
                if (node.children[0].value.type === 'integer') {
                    terms.push(node.children[0]);
                    continue;
                }

                if (node.children[0].value.type === 'symbol' && node.children[0].value.value === '(') {
                    const { ops: deepOps, terms: deepTerms } = this.getExpressionData(node.children[1]);
                    ops = [...deepOps, ...ops]; // deepOps go first
                    terms = [...terms, ...deepTerms];
                    continue;
                }
            }
        }

        return { ops, terms };
    }

    private generateTerm(termNode: Node) {
        if (termNode.value.type === 'integer') {
            this.vmWriter.writePush('constant', termNode.value.value as number);
        }
    }

    private generateOp(opNode: Node) {
        if (opNode.value.value === '+') {
            this.vmWriter.writeArithmetic('add');
        }

        if (opNode.value.value === '*') {
            this.vmWriter.writeCall('Math.multiply', 2);
        }
    }

    private generateReturnStatement(statementNode: Node) {
        if (this.currentSubroutineReturnType === 'void') {
            this.vmWriter.writePush('constant', 0);
        }

        this.vmWriter.writeReturn();
    }

    private findSubroutineBody(subroutineNode: Node): Node {
        const node = subroutineNode.children.find((child) => child.value.type === 'subroutineBody');

        if (!node) {
            throw new Error('Could not find subroutine body');
        }

        return node;
    }

    private findSubroutineName(subroutineNode: Node): string {
        const node = subroutineNode.children.find(
            (child) =>
                child.value.type === 'identifier' &&
                child.value.category === 'subroutine' &&
                child.value.context === 'declaration'
        );

        if (!node) {
            throw new Error('Could not find subroutine declaration');
        }

        return node.value.value as string;
    }

    private findVariableData(subroutineName: string, subroutineNode: Node): VariableData {
        const node = subroutineNode.children.find((child) => child.value.type === 'variableData');

        if (!node) {
            throw new Error(`Could not find variable data for subroutine: ${subroutineName}`);
        }

        return node.value.props as VariableData;
    }

    private findReturnType(subroutineNode: Node): string {
        const node = subroutineNode.children.find((child) => child.value.type === 'returnType');

        if (!node) {
            throw new Error('Could not find subroutine return type');
        }

        return node.value.value as string;
    }
}
