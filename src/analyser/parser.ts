import { INDENT_SIZE, KEYWORD_CONSTANTS, OPERATORS, UNARY_OPERATORS } from './constants';
import { IdentifierCategory, IdentifierContext } from './identifier';
import { Token } from './token';
import { Tokenizer } from './tokenizer';
import { Validator } from './validator';
import { VariableKind, VariableTable } from './variable-table';

export type ParserOutput = {
    tokens: string[];
    parseTree: string[];
};

export class Parser {
    private readonly tokenizer: Tokenizer;
    private token: Token;
    private output: ParserOutput = { tokens: [], parseTree: [] };
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;
    private indent = 0;

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
        this.output.tokens = this.tokenizer.getTokens();
    }

    parseClass(): void {
        this.writeXML('<class>');
        this.increaseIndent();

        this.setNextToken();
        this.parseKeyword('class');

        this.setNextToken();
        this.parseIdentifier('class', 'declaration');

        this.setNextToken();
        this.parseSymbol('{');

        while (this.tokenizer.hasMoreTokens()) {
            this.setNextToken();

            switch (this.token.value) {
                case 'static':
                case 'field':
                    this.parseClassVarDec();
                    break;
                case 'constructor':
                case 'function':
                case 'method':
                    this.parseSubroutineDec();
                    break;
                default:
                    this.parseSymbol('}');
                    break;
            }
        }

        this.decreaseIndent();
        this.writeXML('</class>');
    }

    getOutput(): ParserOutput {
        return this.output;
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

        this.output.parseTree.push(out);
    }

    private parseIdentifier(
        category: IdentifierCategory,
        context: IdentifierContext,
        variable?: { type: string; kind: VariableKind }
    ): void {
        Validator.validateIdentifier(this.token);

        this.writeXML('<identifier>');
        this.increaseIndent();

        this.writeXML(`<category>${category}</category>`);
        this.writeXML(`<context>${context}</context>`);
        this.writeXML(`<value>${this.token.value}</value>`);

        if (category === 'variable' && variable) {
            const table = ['local', 'argument'].includes(variable.kind) ? 'subroutine' : 'class';
            const toAdd = { ...variable, name: this.token.value.toString() };
            const added = table === 'subroutine' ? this.subroutineVarTable.add(toAdd) : this.classVarTable.add(toAdd);

            this.writeXML(`<type>${variable.type}</type>`);
            this.writeXML(`<kind>${variable.kind}</kind>`);
            this.writeXML(`<varTable>${table}</varTable>`);
            this.writeXML(`<varTableIndex>${added.index}</varTableIndex>`);
        }

        this.decreaseIndent();
        this.writeXML('</identifier>');
    }

    private parseKeyword(keyword: string): void {
        Validator.validateKeyword(this.token, keyword);
        this.writeXML();
    }

    private parseOneOfKeywords(keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeXML();
    }

    private parseSymbol(symbol: string): void {
        Validator.validateSymbol(this.token, symbol);
        this.writeXML();
    }

    private parseOneOfSymbols(symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeXML();
    }

    private parseType(): void {
        Validator.validateType(this.token);
        this.writeXML();
    }

    private parseSubroutineReturnType(): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeXML();
    }

    private parseInteger(): void {
        Validator.validateIntegerValue(this.token);
        this.writeXML();
    }

    private parseClassVarDec(): void {
        this.writeXML('<classVarDec>');
        this.increaseIndent();

        this.parseOneOfKeywords(['field', 'static']);
        const kind = this.token.value;
        this.setNextToken();
        this.parseVarDec(<VariableKind>kind);

        this.decreaseIndent();
        this.writeXML('</classVarDec>');
    }

    private parseSubroutineDec(): void {
        this.writeXML('<subroutineDec>');
        this.increaseIndent();

        this.parseOneOfKeywords(['constructor', 'method', 'function']);

        this.setNextToken();
        this.parseSubroutineReturnType();

        this.setNextToken();
        this.parseIdentifier('subroutine', 'declaration');

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseParameterList();
        this.parseSymbol(')');

        this.setNextToken();
        this.parseSubroutineBody();

        this.addVariableData();

        this.decreaseIndent();
        this.writeXML('</subroutineDec>');
        this.subroutineVarTable.reset();
    }

    private parseParameterList(): void {
        this.writeXML('<parameterList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseParameter();
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

    private parseParameter(): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier('variable', 'usage', { type, kind: 'argument' });
    }

    private parseSubroutineBody(): void {
        this.writeXML('<subroutineBody>');
        this.increaseIndent();

        this.parseSymbol('{');
        this.setNextToken();
        this.parseSubroutineVars();
        this.parseStatements();
        this.parseSymbol('}');

        this.decreaseIndent();
        this.writeXML('</subroutineBody>');
    }

    private parseSubroutineVars(): void {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.parseSubroutineVarDec();
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec(): void {
        this.writeXML('<varDec>');
        this.increaseIndent();

        this.parseKeyword('var');
        this.setNextToken();
        this.parseVarDec('local');

        this.decreaseIndent();
        this.writeXML('</varDec>');
    }

    /**
     * parses "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec(kind: VariableKind): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier('variable', 'declaration', { type, kind });

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeXML();
                this.setNextToken();
                this.parseIdentifier('variable', 'declaration', { type, kind });
                continue;
            }

            this.parseSymbol(';');
            semicolonReached = true;
        }
    }

    /**
     * parses statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseStatements(): void {
        this.writeXML('<statements>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === '}';
        while (!closingBracketsReached) {
            switch (this.token.value) {
                case 'let':
                    this.parseLet();
                    break;
                case 'if':
                    this.parseIf();
                    break;
                case 'while':
                    this.parseWhile();
                    break;
                case 'do':
                    this.parseDo();
                    break;
                case 'return':
                    this.parseReturn();
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

    private parseLet(): void {
        this.writeXML('<letStatement>');
        this.increaseIndent();
        this.parseKeyword('let');

        this.setNextToken();
        this.parseIdentifier('variable', 'definition');

        this.setNextToken();
        if (this.token.value !== '=') {
            this.parseSymbol('[');

            this.setNextToken();
            this.parseExpression();
            this.parseSymbol(']');

            this.setNextToken();
        }

        this.parseSymbol('=');

        this.setNextToken();
        this.parseExpression();
        this.parseSymbol(';');

        this.decreaseIndent();
        this.writeXML('</letStatement>');
    }

    private parseIf(): void {
        this.writeXML('<ifStatement>');
        this.increaseIndent();

        this.parseKeyword('if');

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseExpression();
        this.parseSymbol(')');

        this.setNextToken();
        this.parseSymbol('{');

        this.setNextToken();
        this.parseStatements();
        this.parseSymbol('}');

        const tokenAhead: Token = this.tokenizer.lookAhead();
        if (tokenAhead?.value === 'else') {
            this.setNextToken();
            this.parseKeyword('else');

            this.setNextToken();
            this.parseSymbol('{');

            this.setNextToken();
            this.parseStatements();
            this.parseSymbol('}');
        }

        this.decreaseIndent();
        this.writeXML('</ifStatement>');
    }

    private parseWhile(): void {
        this.writeXML('<whileStatement>');
        this.increaseIndent();

        this.parseKeyword('while');

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseExpression();
        this.parseSymbol(')');

        this.setNextToken();
        this.parseSymbol('{');

        this.setNextToken();
        this.parseStatements();
        this.parseSymbol('}');

        this.decreaseIndent();
        this.writeXML('</whileStatement>');
    }

    private parseDo(): void {
        this.writeXML('<doStatement>');
        this.increaseIndent();

        this.parseKeyword('do');

        this.setNextToken();
        this.parseSubroutineCall();

        this.setNextToken();
        this.parseSymbol(';');

        this.decreaseIndent();
        this.writeXML('</doStatement>');
    }

    private parseReturn(): void {
        this.writeXML('<returnStatement>');
        this.increaseIndent();

        this.parseKeyword('return');

        this.setNextToken();
        if (this.token.value !== ';') {
            this.parseExpression();
        }

        this.parseSymbol(';');

        this.decreaseIndent();
        this.writeXML('</returnStatement>');
    }

    /**
     * parses expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpression(): void {
        this.writeXML('<expression>');
        this.increaseIndent();

        this.parseTerm();

        this.setNextToken();
        while (this.token.type === 'SYMBOL' && OPERATORS.includes(this.token.value as string)) {
            this.writeXML();
            this.setNextToken();
            this.parseTerm();
            this.setNextToken();
        }

        this.decreaseIndent();
        this.writeXML('</expression>');
    }

    private parseTerm(): void {
        this.writeXML('<term>');
        this.increaseIndent();

        switch (this.token.type) {
            case 'INT_CONST':
                this.parseInteger();
                break;
            case 'STRING_CONST':
                this.writeXML();
                break;
            case 'KEYWORD':
                this.parseOneOfKeywords(KEYWORD_CONSTANTS);
                break;
            case 'IDENTIFIER':
                const tokenAhead: Token = this.tokenizer.lookAhead();

                if (tokenAhead?.value === '[') {
                    this.writeXML();

                    this.setNextToken();
                    this.parseSymbol('[');

                    this.setNextToken();
                    this.parseExpression();

                    this.parseSymbol(']');
                    break;
                }

                if (tokenAhead?.value === '(' || tokenAhead?.value === '.') {
                    this.parseSubroutineCall();
                    break;
                }

                this.writeXML();
                break;
            case 'SYMBOL':
                if (this.token.value === '(') {
                    this.parseSymbol('(');

                    this.setNextToken();
                    this.parseExpression();

                    this.parseSymbol(')');
                    break;
                }

                this.parseOneOfSymbols(UNARY_OPERATORS);
                this.setNextToken();
                this.parseTerm();
                break;
        }

        this.decreaseIndent();
        this.writeXML('</term>');
    }

    private parseSubroutineCall(): void {
        const tokenAhead: Token = this.tokenizer.lookAhead();
        const category = tokenAhead.value === '(' ? 'subroutine' : 'class';
        this.parseIdentifier(category, 'usage');

        this.setNextToken();
        this.parseOneOfSymbols(['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.parseExpressionList();
            this.parseSymbol(')');
            return;
        }

        this.setNextToken();
        this.parseIdentifier('subroutine', 'usage');

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseExpressionList();
        this.parseSymbol(')');
    }

    /**
     * parses a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpressionList(): void {
        this.writeXML('<expressionList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseExpression();
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

    private addVariableData(): void {
        this.writeXML('<variableData>');
        this.increaseIndent();

        this.writeXML(`<nArgs>${this.subroutineVarTable.kindCount('argument')}</nArgs>`);
        this.writeXML(`<nVars>${this.subroutineVarTable.kindCount('local')}</nVars>`);

        this.decreaseIndent();
        this.writeXML('</variableData>');
    }
}
