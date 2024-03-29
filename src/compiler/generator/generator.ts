import { OPERATORS, UNARY_OPERATORS } from '../constants';
import {
    Command,
    IdentifierCategory,
    IdentifierContext,
    JackKeyword,
    JackSymbol,
    LexicalElement,
    MemorySegment,
    ParseTreeElement,
    VariableKind,
} from '../defines';
import { JackSyntaxError } from '../error';
import { ParseTree, ParseTreeNode } from '../parse-tree';
import { VariableData } from '../types';
import { VMWriter } from './vm-writer';

export type SubroutineData = {
    returnType: string;
    locals: ParseTreeNode[];
    args: ParseTreeNode[];
    isMethod: boolean;
};

export type ClassData = {
    name: string;
    vars: ParseTreeNode[];
    whileLoops: number;
    ifStatements: number;
    constructorExists: boolean;
};

const defaultSubroutineData: SubroutineData = {
    returnType: 'void',
    locals: [],
    args: [],
    isMethod: false,
};

export class CodeGenerator {
    private readonly vmWriter: VMWriter;
    private classData: ClassData;
    private subroutineData = defaultSubroutineData;

    constructor(private readonly tree: ParseTree) {
        this.vmWriter = new VMWriter();
        this.classData = {
            name: this.findClassName(),
            vars: [],
            whileLoops: 0,
            ifStatements: 0,
            constructorExists: false,
        };
    }

    generate(): void {
        for (const node of this.tree.root.children) {
            if (node.value.type === ParseTreeElement.CLASS_VAR_DEC) {
                this.setClassVars(node);
                continue;
            }

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

        if (this.isConstructor(subroutine)) {
            this.generateConstructorSetup();
        }

        if (this.subroutineData.isMethod) {
            // set argument 0 as this
            this.vmWriter.writePush(MemorySegment.ARGUMENT, 0);
            this.vmWriter.writePop(MemorySegment.POINTER, 0);
        }

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

    private generateConstructorSetup(): void {
        if (this.classData.constructorExists) {
            throw new JackSyntaxError('Constructor already exists');
        }

        // allocate memory for object based on its size (`Memory.alloc` returns objects base address)
        this.vmWriter.writePush(MemorySegment.CONSTANT, this.findInstanceVariableCount());
        this.vmWriter.writeCall('Memory.alloc', 1);

        // anchor `this` at objects base address
        // pointer 0 =  THIS = 0x0003
        // this      = *THIS = M[0x0003] -> M[n]
        this.vmWriter.writePop(MemorySegment.POINTER, 0);

        this.classData.constructorExists = true;
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

        if (this.isArray(statement)) {
            this.generateArrayAssignment(varDec, statement);
            return;
        }

        const expression = this.findExpression(statement);
        this.generateExpression(expression);

        if (!varDec.value.props) {
            throw new JackSyntaxError('Missing variable properties');
        }

        this.generateVariablePop(varDec);
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

    // maybe rewrite this, so its more understandable..
    private generateDoStatement(statement: ParseTreeNode): void {
        const isStaticCall = this.isStaticCall(statement);
        let name = '';
        let nArgs = 0;
        let classProbablyUsed = false;

        for (const node of statement.children) {
            if (node.value.type === LexicalElement.IDENTIFIER) {
                if (node.value.category === IdentifierCategory.VARIABLE) {
                    this.generateVariablePush(node);
                    nArgs += 1;
                    name += node.value.props!.type;
                    classProbablyUsed = true;
                    continue;
                }

                if (!isStaticCall && !classProbablyUsed) {
                    // assuming this is current class method call
                    this.vmWriter.writePush(MemorySegment.POINTER, 0);
                    nArgs += 1;
                    name += `${this.classData.name}.${node.value.value}`;
                    continue;
                }

                name += node.value.value;
                continue;
            }

            if (node.value.type === LexicalElement.SYMBOL && node.value.value === JackSymbol.DOT) {
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

        if (statement.value.type === ParseTreeElement.DO) {
            // void call, dump return value
            this.vmWriter.writePop(MemorySegment.TEMP, 0);
        }
    }

    private generateVariablePush(variable: ParseTreeNode): void {
        const { segment, index } = this.findVariableSegmentAndIndex(variable);
        this.vmWriter.writePush(segment, index);
    }

    private generateVariablePop(variable: ParseTreeNode): void {
        const { segment, index } = this.findVariableSegmentAndIndex(variable);
        this.vmWriter.writePop(segment, index);
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

            if (child.value.type === LexicalElement.STRING) {
                this.generateString(child);
                return;
            }

            if (child.value.type === LexicalElement.KEYWORD && child.value.value === JackKeyword.THIS) {
                this.vmWriter.writePush(MemorySegment.POINTER, 0);
                return;
            }

            if (
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.VARIABLE &&
                child.value.context === IdentifierContext.USAGE
            ) {
                this.generateVariablePush(child);

                if (!this.isArray(child)) {
                    return;
                }

                // find and generate array index expression and sum it with base address (pushed above)
                const indexExpression = this.findExpression(child);
                this.generateExpression(indexExpression);
                this.vmWriter.writeArithmetic(Command.ADD);

                // set that segment and push the indexed array value on stack
                this.vmWriter.writePop(MemorySegment.POINTER, 1);
                this.vmWriter.writePush(MemorySegment.THAT, 0);

                return;
            }
        }

        if (this.isExpressionTerm(term)) {
            const expression = this.findExpression(term);
            this.generateExpression(expression);
            return;
        }

        if (this.isUnaryOpTerm(term)) {
            this.generateTerm(term.children[1]);
            this.generateOp(term.children[0], true);
            return;
        }

        if (this.isSubroutineCallTerm(term)) {
            this.generateDoStatement(term);
            return;
        }
    }

    private generateString(string: ParseTreeNode): void {
        const stringValue = <string>string.value.value;
        const stringLength = stringValue.length;

        this.vmWriter.writePush(MemorySegment.CONSTANT, stringLength);
        this.vmWriter.writeCall('String.new', 1); // return value just sits on stack..

        for (let i = 0; i < stringLength; i++) {
            this.vmWriter.writePush(MemorySegment.CONSTANT, stringValue.charCodeAt(i));
            this.vmWriter.writeCall('String.appendChar', 2); // arg 0 = string object, arg 1 = char code
        }
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

    private generateArrayAssignment(varDec: ParseTreeNode, statement: ParseTreeNode): void {
        // using varDec info push arrays base address to stack
        this.generateVariablePush(varDec);

        // find and generate index expression
        const indexExpression = this.findExpression(statement);
        this.generateExpression(indexExpression);

        // add (now we have base + index on stack)
        this.vmWriter.writeArithmetic(Command.ADD);

        // find and generate right hand expression
        const valueExpression = this.findAnyOtherExpression(statement, indexExpression.key);
        this.generateExpression(valueExpression);

        // pop its value to temp 0
        this.vmWriter.writePop(MemorySegment.TEMP, 0);

        // now we have array base + index left on stack, set it as that segment
        this.vmWriter.writePop(MemorySegment.POINTER, 1);

        // now push right hand expression value on the stack and then assign to array
        this.vmWriter.writePush(MemorySegment.TEMP, 0);
        this.vmWriter.writePop(MemorySegment.THAT, 0);
    }

    private clearSubroutineData(): void {
        this.subroutineData = defaultSubroutineData;
    }

    //#region setters
    private setClassVars(varDec: ParseTreeNode): void {
        const vars = this.findIdentifiers(varDec);
        this.classData.vars = [...this.classData.vars, ...vars];
    }

    private setSubroutineLocalVars(varDec: ParseTreeNode): void {
        const vars = this.findIdentifiers(varDec);
        this.subroutineData.locals = [...this.subroutineData.locals, ...vars];
    }

    private setSubroutineArgs(subroutine: ParseTreeNode): void {
        const params = this.findSubroutineParams(subroutine);
        this.subroutineData.args = this.findIdentifiers(params);
    }

    private setSubroutineReturnType(subroutine: ParseTreeNode): void {
        this.subroutineData.returnType = this.findReturnType(subroutine);
    }

    private setSubroutineData(subroutine: ParseTreeNode): void {
        this.setSubroutineReturnType(subroutine);
        this.setSubroutineArgs(subroutine);
        this.subroutineData.locals = [];
        this.subroutineData.isMethod = this.isMethod(subroutine);
    }

    //#endregion

    //#region finders
    private findClassName(): string {
        const node = this.tree.root.children.find(
            (child) =>
                child.value.type === LexicalElement.IDENTIFIER &&
                child.value.category === IdentifierCategory.CLASS &&
                child.value.context === IdentifierContext.DECLARATION
        );

        if (!node) {
            throw new JackSyntaxError('Could not find class declaration');
        }

        return <string>node.value.value;
    }

    private findVariableDeclaration(name: string): ParseTreeNode {
        const subLocal = this.subroutineData.locals.find((node) => node.value.value === name);
        const subArg = this.subroutineData.args.find((node) => node.value.value === name);
        const classVar = this.classData.vars.find((node) => node.value.value === name);

        const variable = subLocal || subArg || classVar;

        if (!variable) {
            throw new JackSyntaxError('Could not find variable');
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
            throw new JackSyntaxError('Could not find variable definition');
        }

        return node;
    }

    private findSubroutineParams(subroutine: ParseTreeNode): ParseTreeNode {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.PARAM_LIST);

        if (!node) {
            throw new JackSyntaxError('Could not find param list');
        }

        return node;
    }

    private findSubroutineBody(subroutine: ParseTreeNode): ParseTreeNode {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.SUBROUTINE_BODY);

        if (!node) {
            throw new JackSyntaxError('Could not find subroutine body');
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
            throw new JackSyntaxError('Could not find subroutine declaration');
        }

        return <string>node.value.value;
    }

    private findVariableData(subroutineName: string, subroutine: ParseTreeNode): VariableData {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.VAR_DATA);

        if (!node) {
            throw new JackSyntaxError(`Could not find variable data for subroutine: ${subroutineName}`);
        }

        return <VariableData>node.value.props;
    }

    private findVariableSegment(variable: ParseTreeNode): MemorySegment {
        return variable.value.props!.kind === VariableKind.FIELD
            ? MemorySegment.THIS
            : <MemorySegment>variable.value.props!.kind;
    }

    private findReturnType(subroutine: ParseTreeNode): string {
        const node = subroutine.children.find((child) => child.value.type === ParseTreeElement.RETURN_TYPE);

        if (!node) {
            throw new JackSyntaxError('Could not find subroutine return type');
        }

        return <string>node.value.value;
    }

    private findExpression(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find((child) => child.value.type === ParseTreeElement.EXPRESSION);
        if (!node) {
            throw new JackSyntaxError('Could not find expression');
        }

        return node;
    }

    // will find first expression node on the same level (useful if looking for subsequent expression)
    private findAnyOtherExpression(parent: ParseTreeNode, excludeNodeKey: string): ParseTreeNode {
        const node = parent.children.find(
            (child) => child.value.type === ParseTreeElement.EXPRESSION && excludeNodeKey !== child.key
        );
        if (!node) {
            throw new JackSyntaxError('Could not find expression');
        }

        return node;
    }

    private findStatements(parent: ParseTreeNode): ParseTreeNode {
        const node = parent.children.find((child) => child.value.type === ParseTreeElement.STATEMENTS);
        if (!node) {
            throw new JackSyntaxError('Could not find statements');
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

    private findIdentifiers(parent: ParseTreeNode): ParseTreeNode[] {
        return parent.children.filter((child) => child.value.type === LexicalElement.IDENTIFIER);
    }

    private findInstanceVariableCount(): number {
        let count = 0;

        for (const node of this.classData.vars) {
            const segment = this.findVariableSegment(node);
            if (segment === MemorySegment.THIS) {
                count++;
            }
        }

        return count;
    }

    private findVariableSegmentAndIndex(variable: ParseTreeNode): { segment: MemorySegment; index: number } {
        const segment = this.findVariableSegment(variable);
        const varTableIndex = <number>variable.value.props!.varTableIndex;
        const index =
            segment === MemorySegment.ARGUMENT && this.subroutineData.isMethod ? varTableIndex + 1 : varTableIndex;
        return { segment, index };
    }
    //#endregion

    //#region term
    private isUnaryOpTerm(term: ParseTreeNode): boolean {
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

    private isSubroutineCallTerm(term: ParseTreeNode): boolean {
        const length = term.children.length;
        if (length >= 4) {
            // pattern for last (or only) four nodes: <identifier(usage)> <symbol>( <expressionList> <symbol>)
            const id = term.children[length - 4];
            const openBracket = term.children[length - 3];
            const expressionList = term.children[length - 2];
            const closeBracket = term.children[length - 1];

            if (
                id.value.type === LexicalElement.IDENTIFIER &&
                id.value.context === IdentifierContext.USAGE &&
                openBracket.value.type === LexicalElement.SYMBOL &&
                openBracket.value.value === JackSymbol.BRACKET_OPEN &&
                expressionList.value.type === ParseTreeElement.EXPRESSION_LIST &&
                closeBracket.value.type === LexicalElement.SYMBOL &&
                closeBracket.value.value === JackSymbol.BRACKET_CLOSE
            ) {
                return true;
            }
        }

        return false;
    }
    //#endregion

    //#region checks
    private isConstructor(subroutine: ParseTreeNode): boolean {
        const first = subroutine.children[0];
        return first.value.type === LexicalElement.KEYWORD && first.value.value === JackKeyword.CONSTRUCTOR;
    }

    private isMethod(subroutine: ParseTreeNode): boolean {
        const first = subroutine.children[0];
        return first.value.type === LexicalElement.KEYWORD && first.value.value === JackKeyword.METHOD;
    }

    private isStaticCall(doStatement: ParseTreeNode): boolean {
        const classIdentifier = this.findIdentifiers(doStatement).find(
            (id) => id.value.category === IdentifierCategory.CLASS && id.value.context === IdentifierContext.USAGE
        );
        return typeof classIdentifier !== 'undefined';
    }

    private isArray(parent: ParseTreeNode): boolean {
        const squareBracket = parent.children.find(
            (child) =>
                child.value.type === LexicalElement.SYMBOL && child.value.value === JackSymbol.SQUARE_BRACKET_OPEN
        );

        return typeof squareBracket !== 'undefined';
    }
    //#endregion
}
