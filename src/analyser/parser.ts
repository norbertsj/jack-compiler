import { INDENT_SIZE, KEYWORD_CONSTANTS, OPERATORS, UNARY_OPERATORS } from './constants';
import { IdentifierCategory, IdentifierContext } from './identifier';
import { Token } from './token';
import { Tokenizer } from './tokenizer';
import { Node, NodeValue, Tree } from './tree';
import { Validator } from './validator';
import { Variable, VariableKind, VariableTable } from './variable-table';

export type ParserOutput = {
    tokens: string[];
    parseTree: Tree;
    parseTreeXML: string[];
};

export class Parser {
    private readonly tokenizer: Tokenizer;
    private token: Token;
    private parseTreeXML: string[] = [];
    private parseTree: Tree;
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;
    private indent = 0;

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
    }

    parseClass(): void {
        this.startParseTree();

        this.setNextToken();
        this.parseIdentifier(this.parseTree.root, 'class', 'declaration');

        this.setNextToken();
        this.parseSymbol(this.parseTree.root, '{');

        while (this.tokenizer.hasMoreTokens()) {
            this.setNextToken();

            if (['static', 'field'].includes(this.token.value as string)) {
                this.parseClassVarDec(this.parseTree.root);
                continue;
            }

            if (['constructor', 'function', 'method'].includes(this.token.value as string)) {
                this.parseSubroutineDec(this.parseTree.root);
                continue;
            }

            this.parseSymbol(this.parseTree.root, '}');
        }

        this.finishParseTree();
    }

    getOutput(): ParserOutput {
        return { tokens: this.tokenizer.getTokens(), parseTree: this.parseTree, parseTreeXML: this.parseTreeXML };
    }

    private increaseIndent() {
        this.indent++;
    }

    private decreaseIndent() {
        this.indent--;
    }

    private setNextToken(): void {
        this.tokenizer.advance();
        this.token = this.tokenizer.look();
    }

    private writeXML(xmlString: string = undefined): void {
        let out = xmlString || this.token.xml;

        if (this.indent > 0) {
            out = out.padStart(out.length + this.indent * INDENT_SIZE);
        }

        this.parseTreeXML.push(out);
    }

    private parseIdentifier(
        parent: Node,
        category: IdentifierCategory,
        context: IdentifierContext,
        variable?: { type: string; kind: VariableKind; index?: number }
    ): Node {
        Validator.validateIdentifier(this.token);

        this.writeXML('<identifier>');
        this.increaseIndent();

        this.writeXML(`<category>${category}</category>`);
        this.writeXML(`<context>${context}</context>`);
        this.writeXML(`<value>${this.token.value}</value>`);

        const nodeValue: NodeValue = {
            type: 'IDENTIFIER',
            value: this.token.value,
            category,
            context,
        };

        if (category === 'variable' && variable) {
            let index = 0;
            const table = ['local', 'argument'].includes(variable.kind) ? 'subroutine' : 'class';

            if (typeof variable.index !== 'undefined') {
                index = variable.index;
            } else {
                const toAdd = { ...variable, name: this.token.value.toString() };
                const added =
                    table === 'subroutine' ? this.subroutineVarTable.add(toAdd) : this.classVarTable.add(toAdd);
                index = added.index;
            }

            this.writeXML(`<type>${variable.type}</type>`);
            this.writeXML(`<kind>${variable.kind}</kind>`);
            this.writeXML(`<varTable>${table}</varTable>`);
            this.writeXML(`<varTableIndex>${index}</varTableIndex>`);

            nodeValue.props = {
                type: variable.type,
                kind: variable.kind,
                varTable: table,
                varTableIndex: index,
            };
        }

        if (category === 'variable' && context === 'usage') {
        }

        this.decreaseIndent();
        this.writeXML('</identifier>');

        return parent.addChild(nodeValue);
    }

    private startParseTree(): void {
        this.setNextToken();
        Validator.validateKeyword(this.token, 'class');

        this.writeXML('<class>');
        this.increaseIndent();
        this.writeXML();

        this.parseTree = new Tree({ type: 'KEYWORD', value: 'class' });
    }

    private finishParseTree(): void {
        this.decreaseIndent();
        this.writeXML('</class>');
    }

    private parseKeyword(parent: Node, value: string): void {
        Validator.validateKeyword(this.token, value);
        this.writeXML();
        parent.addChild({ type: 'KEYWORD', value });
    }

    private parseOneOfKeywords(parent: Node, keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeXML();
        parent.addChild({ type: 'KEYWORD', value: this.token.value });
    }

    private parseSymbol(parent: Node, value: string): void {
        Validator.validateSymbol(this.token, value);
        this.writeXML();
        parent.addChild({ type: 'SYMBOL', value });
    }

    private parseOneOfSymbols(parent: Node, symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeXML();
        parent.addChild({ type: 'SYMBOL', value: this.token.value });
    }

    private parseType(): void {
        Validator.validateType(this.token);
        this.writeXML();
    }

    private parseSubroutineReturnType(parent: Node): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeXML();
        parent.addChild({ type: 'RETURN_TYPE', value: this.token.value });
    }

    private parseInteger(parent: Node): void {
        Validator.validateIntegerValue(this.token);
        this.writeXML();
        parent.addChild({ type: 'INT_CONST', value: this.token.value });
    }

    private parseString(parent: Node): void {
        this.writeXML();
        parent.addChild({ type: 'STRING_CONST', value: this.token.value });
    }

    private parseClassVarDec(parent: Node): Node {
        const varNode = parent.addChild({ type: 'CLASS_VAR_DEC' });

        this.writeXML('<classVarDec>');
        this.increaseIndent();

        this.parseOneOfKeywords(varNode, ['field', 'static']);
        const kind = this.token.value;
        this.setNextToken();
        this.parseVarDec(varNode, <VariableKind>kind);

        this.decreaseIndent();
        this.writeXML('</classVarDec>');

        return varNode;
    }

    private parseSubroutineDec(parent: Node): Node {
        this.writeXML('<subroutineDec>');
        this.increaseIndent();

        const subroutineNode = parent.addChild({ type: 'SUBROUTINE_DEC' });

        this.parseOneOfKeywords(subroutineNode, ['constructor', 'method', 'function']);

        this.setNextToken();
        this.parseSubroutineReturnType(subroutineNode);

        this.setNextToken();
        this.parseIdentifier(subroutineNode, 'subroutine', 'declaration');

        this.setNextToken();
        this.parseSymbol(subroutineNode, '(');

        this.setNextToken();
        this.parseParameterList(subroutineNode);
        this.parseSymbol(subroutineNode, ')');

        this.setNextToken();
        this.parseSubroutineBody(subroutineNode);

        this.addVariableData(subroutineNode);

        this.decreaseIndent();
        this.writeXML('</subroutineDec>');
        this.subroutineVarTable.reset();

        return subroutineNode;
    }

    private parseParameterList(parent: Node): void {
        const paramList = parent.addChild({ type: 'PARAM_LIST' });

        this.writeXML('<parameterList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseParameter(paramList);
            this.setNextToken();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeXML();
                this.setNextToken();
                closingBracketsReached = false; // expecting another parameter
            }
        }

        this.decreaseIndent();
        this.writeXML('</parameterList>');
    }

    private parseParameter(parent: Node): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier(parent, 'variable', 'usage', { type, kind: 'argument' });
    }

    private parseSubroutineBody(parent: Node): void {
        this.writeXML('<subroutineBody>');
        this.increaseIndent();

        const bodyNode = parent.addChild({ type: 'SUBROUTINE_BODY' });

        this.parseSymbol(bodyNode, '{');
        this.setNextToken();
        this.parseSubroutineVars(bodyNode);
        this.parseStatements(bodyNode);
        this.parseSymbol(bodyNode, '}');

        this.decreaseIndent();
        this.writeXML('</subroutineBody>');
    }

    private parseSubroutineVars(bodyNode: Node): void {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.parseSubroutineVarDec(bodyNode);
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec(bodyNode: Node): void {
        const varNode = bodyNode.addChild({ type: 'SUBROUTINE_VAR_DEC' });

        this.writeXML('<varDec>');
        this.increaseIndent();

        this.parseKeyword(varNode, 'var');
        this.setNextToken();
        this.parseVarDec(varNode, 'local');

        this.decreaseIndent();
        this.writeXML('</varDec>');
    }

    /**
     * parses "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec(parent: Node, kind: VariableKind): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier(parent, 'variable', 'declaration', { type, kind });

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeXML();
                this.setNextToken();
                this.parseIdentifier(parent, 'variable', 'declaration', { type, kind });
                continue;
            }

            this.parseSymbol(parent, ';');
            semicolonReached = true;
        }
    }

    /**
     * parses statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseStatements(parent: Node): void {
        this.writeXML('<statements>');
        this.increaseIndent();

        const statementsNode = parent.addChild({ type: 'STATEMENTS' });

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === '}';
        while (!closingBracketsReached) {
            switch (this.token.value) {
                case 'let':
                    this.parseLet(statementsNode);
                    break;
                case 'if':
                    this.parseIf(statementsNode);
                    break;
                case 'while':
                    this.parseWhile(statementsNode);
                    break;
                case 'do':
                    this.parseDo(statementsNode);
                    break;
                case 'return':
                    this.parseReturn(statementsNode);
                    break;
                default:
                    closingBracketsReached = true;
                    break;
            }

            if (!closingBracketsReached) {
                this.setNextToken();
            }
        }

        this.decreaseIndent();
        this.writeXML('</statements>');
    }

    private parseLet(parent: Node): void {
        const letNode = parent.addChild({ type: 'LET' });

        this.writeXML('<letStatement>');
        this.increaseIndent();
        this.parseKeyword(letNode, 'let');

        this.setNextToken();
        this.parseIdentifier(letNode, 'variable', 'definition');

        this.setNextToken();
        if (this.token.value !== '=') {
            this.parseSymbol(letNode, '[');

            this.setNextToken();
            this.parseExpression(letNode);
            this.parseSymbol(letNode, ']');

            this.setNextToken();
        }

        this.parseSymbol(letNode, '=');

        this.setNextToken();
        this.parseExpression(letNode);
        this.parseSymbol(letNode, ';');

        this.decreaseIndent();
        this.writeXML('</letStatement>');
    }

    private parseIf(parent: Node): void {
        const ifNode = parent.addChild({ type: 'IF' });

        this.writeXML('<ifStatement>');
        this.increaseIndent();

        this.parseKeyword(ifNode, 'if');

        this.setNextToken();
        this.parseSymbol(ifNode, '(');

        this.setNextToken();
        this.parseExpression(ifNode);
        this.parseSymbol(ifNode, ')');

        this.setNextToken();
        this.parseSymbol(ifNode, '{');

        this.setNextToken();
        this.parseStatements(ifNode);
        this.parseSymbol(ifNode, '}');

        const tokenAhead: Token = this.tokenizer.lookAhead();
        if (tokenAhead?.value === 'else') {
            const elseNode = ifNode.addChild({ type: 'ELSE' });

            this.setNextToken();
            this.parseKeyword(elseNode, 'else');

            this.setNextToken();
            this.parseSymbol(elseNode, '{');

            this.setNextToken();
            this.parseStatements(elseNode);
            this.parseSymbol(elseNode, '}');
        }

        this.decreaseIndent();
        this.writeXML('</ifStatement>');
    }

    private parseWhile(parent: Node): void {
        const whileNode = parent.addChild({ type: 'WHILE' });

        this.writeXML('<whileStatement>');
        this.increaseIndent();

        this.parseKeyword(whileNode, 'while');

        this.setNextToken();
        this.parseSymbol(whileNode, '(');

        this.setNextToken();
        this.parseExpression(whileNode);
        this.parseSymbol(whileNode, ')');

        this.setNextToken();
        this.parseSymbol(whileNode, '{');

        this.setNextToken();
        this.parseStatements(whileNode);
        this.parseSymbol(whileNode, '}');

        this.decreaseIndent();
        this.writeXML('</whileStatement>');
    }

    private parseDo(parent: Node): void {
        this.writeXML('<doStatement>');
        this.increaseIndent();

        const doNode = parent.addChild({ type: 'DO' });

        this.parseKeyword(doNode, 'do');

        this.setNextToken();
        this.parseSubroutineCall(doNode);

        this.setNextToken();
        this.parseSymbol(doNode, ';');

        this.decreaseIndent();
        this.writeXML('</doStatement>');
    }

    private parseReturn(parent: Node): void {
        this.writeXML('<returnStatement>');
        this.increaseIndent();

        const returnNode = parent.addChild({ type: 'RETURN' });

        this.parseKeyword(returnNode, 'return');

        this.setNextToken();
        if (this.token.value !== ';') {
            this.parseExpression(returnNode);
        }

        this.parseSymbol(returnNode, ';');

        this.decreaseIndent();
        this.writeXML('</returnStatement>');
    }

    /**
     * parses expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpression(parent: Node): void {
        this.writeXML('<expression>');
        this.increaseIndent();

        const expressionNode = parent.addChild({ type: 'EXPRESSION' });

        this.parseTerm(expressionNode);

        this.setNextToken();
        while (this.token.type === 'SYMBOL' && OPERATORS.includes(this.token.value as string)) {
            this.writeXML();
            expressionNode.addChild({ type: 'SYMBOL', value: this.token.value });
            this.setNextToken();
            this.parseTerm(expressionNode);
            this.setNextToken();
        }

        this.decreaseIndent();
        this.writeXML('</expression>');
    }

    private parseTerm(parent: Node): void {
        this.writeXML('<term>');
        this.increaseIndent();

        const termNode = parent.addChild({ type: 'TERM' });

        switch (this.token.type) {
            case 'INT_CONST':
                this.parseInteger(termNode);
                break;
            case 'STRING_CONST':
                this.parseString(termNode);
                break;
            case 'KEYWORD':
                this.parseOneOfKeywords(termNode, KEYWORD_CONSTANTS);
                break;
            case 'IDENTIFIER':
                const variable = this.findVariable(this.token.value as string);
                const tokenAhead: Token = this.tokenizer.lookAhead();

                if (tokenAhead?.value === '[' && variable) {
                    this.writeXML();
                    const arrayNode = this.parseIdentifier(termNode, 'variable', 'usage', variable);

                    this.setNextToken();
                    this.parseSymbol(arrayNode, '[');

                    this.setNextToken();
                    this.parseExpression(arrayNode);

                    this.parseSymbol(arrayNode, ']');
                    break;
                }

                if (tokenAhead?.value === '(' || tokenAhead?.value === '.') {
                    this.parseSubroutineCall(termNode);
                    break;
                }

                if (variable) {
                    this.parseIdentifier(termNode, 'variable', 'usage', variable);
                    break;
                }

                this.writeXML();
                break;
            case 'SYMBOL':
                if (this.token.value === '(') {
                    this.parseSymbol(termNode, '(');

                    this.setNextToken();
                    this.parseExpression(termNode);

                    this.parseSymbol(termNode, ')');
                    break;
                }

                this.parseOneOfSymbols(termNode, UNARY_OPERATORS);
                this.setNextToken();
                this.parseTerm(termNode);
                break;
        }

        this.decreaseIndent();
        this.writeXML('</term>');
    }

    private findVariable(name: string): Variable | null {
        const classVar = this.classVarTable.find(name);

        if (classVar) {
            return classVar;
        }

        const localVar = this.subroutineVarTable.find(name);
        return localVar;
    }

    private parseSubroutineCall(parent: Node): void {
        const tokenAhead: Token = this.tokenizer.lookAhead();
        const category = tokenAhead.value === '(' ? 'subroutine' : 'class';
        this.parseIdentifier(parent, category, 'usage');

        this.setNextToken();
        this.parseOneOfSymbols(parent, ['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.parseExpressionList(parent);
            this.parseSymbol(parent, ')');
            return;
        }

        this.setNextToken();
        this.parseIdentifier(parent, 'subroutine', 'usage');

        this.setNextToken();
        this.parseSymbol(parent, '(');

        this.setNextToken();
        this.parseExpressionList(parent);
        this.parseSymbol(parent, ')');
    }

    /**
     * parses a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpressionList(parent: Node): void {
        this.writeXML('<expressionList>');
        this.increaseIndent();

        const listNode = parent.addChild({ type: 'EXPRESSION_LIST' });

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseExpression(listNode);
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeXML();
                this.setNextToken();
                closingBracketsReached = false; // expecting another expression
            }
        }

        this.decreaseIndent();
        this.writeXML('</expressionList>');
    }

    private addVariableData(subroutineNode: Node): void {
        this.writeXML('<variableData>');
        this.increaseIndent();

        this.writeXML(`<nArgs>${this.subroutineVarTable.kindCount('argument')}</nArgs>`);
        this.writeXML(`<nVars>${this.subroutineVarTable.kindCount('local')}</nVars>`);

        this.decreaseIndent();
        this.writeXML('</variableData>');

        subroutineNode.addChild({
            type: 'VAR_DATA',
            props: {
                nArgs: this.subroutineVarTable.kindCount('argument'),
                nVars: this.subroutineVarTable.kindCount('local'),
            },
        });
    }
}
