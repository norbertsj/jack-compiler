import { debug } from '../debug';
import { INDENT_SIZE, KEYWORD_CONSTANTS, OPERATORS, TYPES, UNARY_OPERATORS } from '../constants';
import {
    IdentifierCategory,
    IdentifierContext,
    JackKeyword,
    LexicalElement,
    ParseTreeElement,
    JackSymbol,
    VariableKind,
} from '../defines';
import { ParseTree, ParseTreeNode, ParseTreeNodeValue } from '../parse-tree';
import { Token } from '../types';
import { Tokenizer } from './tokenizer';
import { Validator } from './validator';
import { Variable, VariableTable } from './variable-table';

export type ParserOutput = {
    tokens: string[];
    parseTree: ParseTree;
    parseTreeXML: string[];
};

export class Parser {
    private readonly tokenizer: Tokenizer;
    private token: Token = <Token>{};
    private parseTreeXML: string[] = [];
    private parseTree: ParseTree = <ParseTree>{};
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;
    private indent = 0;

    constructor(fileName: string, input: string[]) {
        this.tokenizer = new Tokenizer(fileName, input);
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
        this.setToken();
    }

    parseClass(): void {
        this.startParseTree();
        this.setNextToken();
        this.parseIdentifier(this.parseTree.root, IdentifierCategory.CLASS, IdentifierContext.DECLARATION);
        this.setNextToken();
        this.parseSymbol(this.parseTree.root, JackSymbol.CURLY_BRACKET_OPEN);
        while (this.tokenizer.hasMoreTokens()) {
            this.setNextToken();
            if ([VariableKind.STATIC, VariableKind.FIELD].includes(<VariableKind>this.token.value)) {
                this.parseClassVarDec(this.parseTree.root);
                continue;
            }
            if (
                [JackKeyword.CONSTRUCTOR, JackKeyword.FUNCTION, JackKeyword.METHOD].includes(
                    <JackKeyword>this.token.value
                )
            ) {
                this.parseSubroutineDec(this.parseTree.root);
                continue;
            }
            this.parseSymbol(this.parseTree.root, JackSymbol.CURLY_BRACKET_CLOSE);
        }
        this.finishParseTree();
    }

    getOutput(): ParserOutput {
        return { tokens: this.tokenizer.getTokens(), parseTree: this.parseTree, parseTreeXML: this.parseTreeXML };
    }

    private startParseTree(): void {
        Validator.validateKeyword(this.token, JackKeyword.CLASS);

        this.writeXML('<class>');
        this.increaseIndent();
        this.writeXML();

        this.parseTree = new ParseTree({ type: LexicalElement.KEYWORD, value: JackKeyword.CLASS });
    }

    private finishParseTree(): void {
        this.decreaseIndent();
        this.writeXML('</class>');
    }

    private increaseIndent(): void {
        this.indent++;
    }

    private decreaseIndent(): void {
        this.indent--;
    }

    private setNextToken(): void {
        this.tokenizer.advance();
        this.setToken();
    }

    private setToken(): void {
        const token = this.tokenizer.look();
        if (token) {
            this.token = token;
        }
    }

    private writeXML(xmlString?: string): void {
        let out = xmlString || this.token.xml;

        if (this.indent > 0) {
            out = out.padStart(out.length + this.indent * INDENT_SIZE);
        }

        this.parseTreeXML.push(out);
    }

    private parseIdentifier(
        parent: ParseTreeNode,
        category: IdentifierCategory,
        context: IdentifierContext,
        variable?: { type: string; kind: VariableKind; index?: number }
    ): ParseTreeNode {
        Validator.validateIdentifier(this.token);

        this.writeXML('<identifier>');
        this.increaseIndent();

        this.writeXML(`<category>${category}</category>`);
        this.writeXML(`<context>${context}</context>`);
        this.writeXML(`<value>${this.token.value}</value>`);

        const nodeValue: ParseTreeNodeValue = {
            type: LexicalElement.IDENTIFIER,
            value: this.token.value,
            category,
            context,
        };

        if (category === IdentifierCategory.VARIABLE && variable) {
            let index = 0;
            const table = [VariableKind.LOCAL, VariableKind.ARGUMENT].includes(variable.kind) ? 'subroutine' : 'class';

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

        this.decreaseIndent();
        this.writeXML('</identifier>');

        return parent.addChild(nodeValue);
    }

    private parseKeyword(parent: ParseTreeNode, value: string): void {
        Validator.validateKeyword(this.token, value);
        this.writeXML();
        parent.addChild({ type: LexicalElement.KEYWORD, value });
    }

    private parseOneOfKeywords(parent: ParseTreeNode, keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeXML();
        parent.addChild({ type: LexicalElement.KEYWORD, value: this.token.value });
    }

    private parseSymbol(parent: ParseTreeNode, value: string): void {
        Validator.validateSymbol(this.token, value);
        this.writeXML();
        parent.addChild({ type: LexicalElement.SYMBOL, value });
    }

    private parseOneOfSymbols(parent: ParseTreeNode, symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeXML();
        parent.addChild({ type: LexicalElement.SYMBOL, value: this.token.value });
    }

    private parseType(): void {
        Validator.validateType(this.token);
        this.writeXML();
    }

    private parseSubroutineReturnType(parent: ParseTreeNode): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeXML();
        parent.addChild({ type: ParseTreeElement.RETURN_TYPE, value: this.token.value });
    }

    private parseInteger(parent: ParseTreeNode): void {
        Validator.validateIntegerValue(this.token);
        this.writeXML();
        parent.addChild({ type: LexicalElement.INTEGER, value: this.token.value });
    }

    private parseString(parent: ParseTreeNode): void {
        this.writeXML();
        parent.addChild({ type: LexicalElement.STRING, value: this.token.value });
    }

    private parseClassVarDec(parent: ParseTreeNode): ParseTreeNode {
        const varNode = parent.addChild({ type: ParseTreeElement.CLASS_VAR_DEC });

        this.writeXML('<classVarDec>');
        this.increaseIndent();

        this.parseOneOfKeywords(varNode, [JackKeyword.FIELD, JackKeyword.STATIC]);
        const kind = this.token.value;
        this.setNextToken();
        this.parseVarDec(varNode, <VariableKind>kind);

        this.decreaseIndent();
        this.writeXML('</classVarDec>');

        return varNode;
    }

    private parseSubroutineDec(parent: ParseTreeNode): ParseTreeNode {
        this.writeXML('<subroutineDec>');
        this.increaseIndent();

        const subroutineNode = parent.addChild({ type: ParseTreeElement.SUBROUTINE_DEC });

        this.parseOneOfKeywords(subroutineNode, [JackKeyword.CONSTRUCTOR, JackKeyword.METHOD, JackKeyword.FUNCTION]);

        this.setNextToken();
        this.parseSubroutineReturnType(subroutineNode);

        this.setNextToken();
        this.parseIdentifier(subroutineNode, IdentifierCategory.SUBROUTINE, IdentifierContext.DECLARATION);

        this.setNextToken();
        this.parseSymbol(subroutineNode, JackSymbol.BRACKET_OPEN);

        this.setNextToken();
        this.parseParameterList(subroutineNode);
        this.parseSymbol(subroutineNode, JackSymbol.BRACKET_CLOSE);

        this.setNextToken();
        this.parseSubroutineBody(subroutineNode);

        this.addVariableData(subroutineNode);

        this.decreaseIndent();
        this.writeXML('</subroutineDec>');
        this.subroutineVarTable.reset();

        return subroutineNode;
    }

    private parseParameterList(parent: ParseTreeNode): void {
        const paramList = parent.addChild({ type: ParseTreeElement.PARAM_LIST });

        this.writeXML('<parameterList>');
        this.increaseIndent();

        let closingBracketsReached: boolean =
            this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.BRACKET_CLOSE;
        while (!closingBracketsReached) {
            this.parseParameter(paramList);
            this.setNextToken();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.COMMA) {
                this.writeXML();
                this.setNextToken();
                closingBracketsReached = false; // expecting another parameter
            }
        }

        this.decreaseIndent();
        this.writeXML('</parameterList>');
    }

    private parseParameter(parent: ParseTreeNode): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier(parent, IdentifierCategory.VARIABLE, IdentifierContext.USAGE, {
            type,
            kind: VariableKind.ARGUMENT,
        });
    }

    private parseSubroutineBody(parent: ParseTreeNode): void {
        this.writeXML('<subroutineBody>');
        this.increaseIndent();

        const bodyNode = parent.addChild({ type: ParseTreeElement.SUBROUTINE_BODY });

        this.parseSymbol(bodyNode, JackSymbol.CURLY_BRACKET_OPEN);
        this.setNextToken();
        this.parseSubroutineVars(bodyNode);
        this.parseStatements(bodyNode);
        this.parseSymbol(bodyNode, JackSymbol.CURLY_BRACKET_CLOSE);

        this.decreaseIndent();
        this.writeXML('</subroutineBody>');
    }

    private parseSubroutineVars(bodyNode: ParseTreeNode): void {
        while (this.token.type === LexicalElement.KEYWORD && this.token.value === JackKeyword.VAR) {
            this.parseSubroutineVarDec(bodyNode);
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec(bodyNode: ParseTreeNode): void {
        const varNode = bodyNode.addChild({ type: ParseTreeElement.SUBROUTINE_VAR_DEC });

        this.writeXML('<varDec>');
        this.increaseIndent();

        this.parseKeyword(varNode, JackKeyword.VAR);
        this.setNextToken();
        this.parseVarDec(varNode, VariableKind.LOCAL);

        this.decreaseIndent();
        this.writeXML('</varDec>');
    }

    /**
     * parses "type varName (','varName)* JackSymbol.SEMICOLON"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec(parent: ParseTreeNode, kind: VariableKind): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier(parent, IdentifierCategory.VARIABLE, IdentifierContext.DECLARATION, { type, kind });

        let semicolonReached = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.COMMA) {
                this.writeXML();
                this.setNextToken();
                this.parseIdentifier(parent, IdentifierCategory.VARIABLE, IdentifierContext.DECLARATION, {
                    type,
                    kind,
                });
                continue;
            }

            this.parseSymbol(parent, JackSymbol.SEMICOLON);
            semicolonReached = true;
        }
    }

    /**
     * parses statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseStatements(parent: ParseTreeNode): void {
        this.writeXML('<statements>');
        this.increaseIndent();

        const statementsNode = parent.addChild({ type: ParseTreeElement.STATEMENTS });

        let closingBracketsReached: boolean =
            this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.CURLY_BRACKET_CLOSE;
        while (!closingBracketsReached) {
            switch (this.token.value) {
                case JackKeyword.LET:
                    this.parseLet(statementsNode);
                    break;
                case JackKeyword.IF:
                    this.parseIf(statementsNode);
                    break;
                case JackKeyword.WHILE:
                    this.parseWhile(statementsNode);
                    break;
                case JackKeyword.DO:
                    this.parseDo(statementsNode);
                    break;
                case JackKeyword.RETURN:
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

    private parseLet(parent: ParseTreeNode): void {
        const letNode = parent.addChild({ type: ParseTreeElement.LET });

        this.writeXML('<letStatement>');
        this.increaseIndent();
        this.parseKeyword(letNode, JackKeyword.LET);

        this.setNextToken();
        this.parseIdentifier(letNode, IdentifierCategory.VARIABLE, IdentifierContext.DEFINITION);

        this.setNextToken();
        if (this.token.value !== JackSymbol.EQ) {
            this.parseSymbol(letNode, JackSymbol.SQUARE_BRACKET_OPEN);

            this.setNextToken();
            this.parseExpression(letNode);
            this.parseSymbol(letNode, JackSymbol.SQUARE_BRACKET_CLOSE);

            this.setNextToken();
        }

        this.parseSymbol(letNode, JackSymbol.EQ);

        this.setNextToken();
        this.parseExpression(letNode);
        this.parseSymbol(letNode, JackSymbol.SEMICOLON);

        this.decreaseIndent();
        this.writeXML('</letStatement>');
    }

    private parseIf(parent: ParseTreeNode): void {
        const ifNode = parent.addChild({ type: ParseTreeElement.IF });

        this.writeXML('<ifStatement>');
        this.increaseIndent();

        this.parseKeyword(ifNode, JackKeyword.IF);

        this.setNextToken();
        this.parseSymbol(ifNode, JackSymbol.BRACKET_OPEN);

        this.setNextToken();
        this.parseExpression(ifNode);
        this.parseSymbol(ifNode, JackSymbol.BRACKET_CLOSE);

        this.setNextToken();
        this.parseSymbol(ifNode, JackSymbol.CURLY_BRACKET_OPEN);

        this.setNextToken();
        this.parseStatements(ifNode);
        this.parseSymbol(ifNode, JackSymbol.CURLY_BRACKET_CLOSE);

        const tokenAhead = this.tokenizer.lookAhead();
        if (tokenAhead?.value === JackKeyword.ELSE) {
            const elseNode = ifNode.addChild({ type: ParseTreeElement.ELSE });

            this.setNextToken();
            this.parseKeyword(elseNode, JackKeyword.ELSE);

            this.setNextToken();
            this.parseSymbol(elseNode, JackSymbol.CURLY_BRACKET_OPEN);

            this.setNextToken();
            this.parseStatements(elseNode);
            this.parseSymbol(elseNode, JackSymbol.CURLY_BRACKET_CLOSE);
        }

        this.decreaseIndent();
        this.writeXML('</ifStatement>');
    }

    private parseWhile(parent: ParseTreeNode): void {
        const whileNode = parent.addChild({ type: ParseTreeElement.WHILE });

        this.writeXML('<whileStatement>');
        this.increaseIndent();

        this.parseKeyword(whileNode, JackKeyword.WHILE);

        this.setNextToken();
        this.parseSymbol(whileNode, JackSymbol.BRACKET_OPEN);

        this.setNextToken();
        this.parseExpression(whileNode);
        this.parseSymbol(whileNode, JackSymbol.BRACKET_CLOSE);

        this.setNextToken();
        this.parseSymbol(whileNode, JackSymbol.CURLY_BRACKET_OPEN);

        this.setNextToken();
        this.parseStatements(whileNode);
        this.parseSymbol(whileNode, JackSymbol.CURLY_BRACKET_CLOSE);

        this.decreaseIndent();
        this.writeXML('</whileStatement>');
    }

    private parseDo(parent: ParseTreeNode): void {
        this.writeXML('<doStatement>');
        this.increaseIndent();

        const doNode = parent.addChild({ type: ParseTreeElement.DO });

        this.parseKeyword(doNode, JackKeyword.DO);

        this.setNextToken();
        this.parseSubroutineCall(doNode);

        this.setNextToken();
        this.parseSymbol(doNode, JackSymbol.SEMICOLON);

        this.decreaseIndent();
        this.writeXML('</doStatement>');
    }

    private parseReturn(parent: ParseTreeNode): void {
        this.writeXML('<returnStatement>');
        this.increaseIndent();

        const returnNode = parent.addChild({ type: ParseTreeElement.RETURN });

        this.parseKeyword(returnNode, JackKeyword.RETURN);

        this.setNextToken();
        if (this.token.value !== JackSymbol.SEMICOLON) {
            this.parseExpression(returnNode);
        }

        this.parseSymbol(returnNode, JackSymbol.SEMICOLON);

        this.decreaseIndent();
        this.writeXML('</returnStatement>');
    }

    /**
     * parses expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpression(parent: ParseTreeNode): void {
        this.writeXML('<expression>');
        this.increaseIndent();

        const expressionNode = parent.addChild({ type: ParseTreeElement.EXPRESSION });

        this.parseTerm(expressionNode);

        this.setNextToken();
        while (this.token.type === LexicalElement.SYMBOL && OPERATORS.includes(<JackSymbol>this.token.value)) {
            this.writeXML();
            expressionNode.addChild({ type: LexicalElement.SYMBOL, value: this.token.value });
            this.setNextToken();
            this.parseTerm(expressionNode);
            this.setNextToken();
        }

        this.decreaseIndent();
        this.writeXML('</expression>');
    }

    private parseTerm(parent: ParseTreeNode): void {
        this.writeXML('<term>');
        this.increaseIndent();

        const termNode = parent.addChild({ type: ParseTreeElement.TERM });

        switch (this.token.type) {
            case LexicalElement.INTEGER:
                this.parseInteger(termNode);
                break;
            case LexicalElement.STRING:
                this.parseString(termNode);
                break;
            case LexicalElement.KEYWORD:
                this.parseOneOfKeywords(termNode, KEYWORD_CONSTANTS);
                break;
            case LexicalElement.IDENTIFIER: {
                const variable = this.findVariable(<string>this.token.value);
                const tokenAhead = this.tokenizer.lookAhead();

                if (tokenAhead?.value === JackSymbol.SQUARE_BRACKET_OPEN && variable) {
                    this.writeXML();
                    const arrayNode = this.parseIdentifier(
                        termNode,
                        IdentifierCategory.VARIABLE,
                        IdentifierContext.USAGE,
                        variable
                    );

                    this.setNextToken();
                    this.parseSymbol(arrayNode, JackSymbol.SQUARE_BRACKET_OPEN);

                    this.setNextToken();
                    this.parseExpression(arrayNode);

                    this.parseSymbol(arrayNode, JackSymbol.SQUARE_BRACKET_CLOSE);
                    break;
                }

                if (tokenAhead?.value === JackSymbol.BRACKET_OPEN || tokenAhead?.value === JackSymbol.DOT) {
                    this.parseSubroutineCall(termNode);
                    break;
                }

                if (variable) {
                    this.parseIdentifier(termNode, IdentifierCategory.VARIABLE, IdentifierContext.USAGE, variable);
                    break;
                }

                this.writeXML();
                break;
            }
            case LexicalElement.SYMBOL:
                if (this.token.value === JackSymbol.BRACKET_OPEN) {
                    this.parseSymbol(termNode, JackSymbol.BRACKET_OPEN);

                    this.setNextToken();
                    this.parseExpression(termNode);

                    this.parseSymbol(termNode, JackSymbol.BRACKET_CLOSE);
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

        return this.subroutineVarTable.find(name);
    }

    private getSubroutineCallIdentifierData(): { category: IdentifierCategory; variable?: Variable } {
        const tokenAhead = this.tokenizer.lookAhead();
        if (tokenAhead?.value === JackSymbol.DOT) {
            const variable = this.findVariable(<string>this.token.value);
            if (variable) {
                return { category: IdentifierCategory.VARIABLE, variable };
            }

            return { category: IdentifierCategory.CLASS };
        }

        return { category: IdentifierCategory.SUBROUTINE };
    }

    private parseSubroutineCall(parent: ParseTreeNode): void {
        const { category, variable } = this.getSubroutineCallIdentifierData();
        this.parseIdentifier(parent, category, IdentifierContext.USAGE, variable);

        this.setNextToken();
        this.parseOneOfSymbols(parent, [JackSymbol.BRACKET_OPEN, JackSymbol.DOT]);

        if (this.token.value === JackSymbol.BRACKET_OPEN) {
            this.setNextToken();
            this.parseExpressionList(parent);
            this.parseSymbol(parent, JackSymbol.BRACKET_CLOSE);
            return;
        }

        this.setNextToken();
        this.parseIdentifier(parent, IdentifierCategory.SUBROUTINE, IdentifierContext.USAGE);

        this.setNextToken();
        this.parseSymbol(parent, JackSymbol.BRACKET_OPEN);

        this.setNextToken();
        this.parseExpressionList(parent);
        this.parseSymbol(parent, JackSymbol.BRACKET_CLOSE);
    }

    /**
     * parses a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpressionList(parent: ParseTreeNode): void {
        this.writeXML('<expressionList>');
        this.increaseIndent();

        const listNode = parent.addChild({ type: ParseTreeElement.EXPRESSION_LIST });

        let closingBracketsReached: boolean =
            this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.BRACKET_CLOSE;
        while (!closingBracketsReached) {
            this.parseExpression(listNode);
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === LexicalElement.SYMBOL && this.token.value === JackSymbol.COMMA) {
                this.writeXML();
                this.setNextToken();
                closingBracketsReached = false; // expecting another expression
            }
        }

        this.decreaseIndent();
        this.writeXML('</expressionList>');
    }

    private addVariableData(subroutineNode: ParseTreeNode): void {
        this.writeXML('<variableData>');
        this.increaseIndent();

        this.writeXML(`<nArgs>${this.subroutineVarTable.kindCount(VariableKind.ARGUMENT)}</nArgs>`);
        this.writeXML(`<nVars>${this.subroutineVarTable.kindCount(VariableKind.LOCAL)}</nVars>`);

        this.decreaseIndent();
        this.writeXML('</variableData>');

        subroutineNode.addChild({
            type: ParseTreeElement.VAR_DATA,
            props: {
                nArgs: this.subroutineVarTable.kindCount(VariableKind.ARGUMENT),
                nVars: this.subroutineVarTable.kindCount(VariableKind.LOCAL),
            },
        });
    }
}
