import Tokenizer from './tokenizer';
import Token from './token';
import Validator from './validator';
import { KEYWORD_CONSTANTS, OPERATORS, UNARY_OPERATORS } from './defines';

export default class Parser {
    private readonly tokenizer: Tokenizer;
    private token: Token;
    private output: string[] = [];

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
    }

    public parseClass() {
        this.writeOutput('<class>');

        this.setNextToken();
        this.parseKeyword('class');

        this.setNextToken();
        this.parseIdentifier();

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

        this.writeOutput('</class>');
    }

    public getOutput(): string[] {
        return this.output;
    }

    private setNextToken(): void {
        this.tokenizer.advance();
        this.token = this.tokenizer.look();
    }

    private writeOutput(xmlString?: string) {
        if (typeof xmlString === 'undefined') {
            this.output.push(this.token.xml);
        } else {
            this.output.push(xmlString);
        }
    }

    private parseIdentifier() {
        Validator.validateIdentifier(this.token);
        this.writeOutput();
    }

    private parseKeyword(keyword: string) {
        Validator.validateKeyword(this.token, keyword);
        this.writeOutput();
    }

    private parseOneOfKeywords(keywords: string[]) {
        Validator.validateKeywords(this.token, keywords);
        this.writeOutput();
    }

    private parseSymbol(symbol: string) {
        Validator.validateSymbol(this.token, symbol);
        this.writeOutput();
    }

    private parseOneOfSymbols(symbols: string[]) {
        Validator.validateSymbols(this.token, symbols);
        this.writeOutput();
    }

    private parseType() {
        Validator.validateType(this.token);
        this.writeOutput();
    }

    private parseSubroutineReturnType() {
        Validator.validateSubroutineReturnType(this.token);
        this.writeOutput();
    }

    private parseInteger() {
        Validator.validateIntegerValue(this.token);
        this.writeOutput();
    }

    private parseClassVarDec() {
        this.writeOutput('<classVarDec>');

        this.parseOneOfKeywords(['field', 'static']);
        this.setNextToken();
        this.parseVarDec();

        this.writeOutput('</classVarDec>');
    }

    private parseSubroutineDec() {
        this.writeOutput('<subroutineDec>');

        this.parseOneOfKeywords(['constructor', 'method', 'function']);

        this.setNextToken();
        this.parseSubroutineReturnType();

        this.setNextToken();
        this.parseIdentifier();

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseParameterList();
        this.parseSymbol(')');

        this.setNextToken();
        this.parseSubroutineBody();

        this.writeOutput('</subroutineDec>');
    }

    private parseParameterList() {
        this.writeOutput('<parameterList>');

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseParameter();
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another parameter
            } else {
                closingBracketsReached = true; // expecting closing bracket (validated later in caller)
            }
        }

        this.writeOutput('</parameterList>');
    }

    private parseParameter() {
        this.parseType();
        this.setNextToken();
        this.parseIdentifier();
    }

    private parseSubroutineBody() {
        this.writeOutput('<subroutineBody>');

        this.parseSymbol('{');
        this.setNextToken();
        this.parseSubroutineVars();
        this.parseStatements();
        this.parseSymbol('}');

        this.writeOutput('</subroutineBody>');
    }

    private parseSubroutineVars() {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.parseSubroutineVarDec();
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec() {
        this.writeOutput('<varDec>');

        this.parseKeyword('var');
        this.setNextToken();
        this.parseVarDec();

        this.writeOutput('</varDec>');
    }

    /**
     * Parses "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec() {
        this.parseType();

        this.setNextToken();
        this.parseIdentifier();

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                this.parseIdentifier();
            } else {
                this.parseSymbol(';');
                semicolonReached = true;
            }
        }
    }

    /**
     * Parses statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseStatements() {
        this.writeOutput('<statements>');

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

        this.writeOutput('</statements>');
    }

    private parseLet() {
        this.writeOutput('<letStatement>');
        this.parseKeyword('let');

        this.setNextToken();
        this.parseIdentifier();

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

        this.writeOutput('</letStatement>');
    }

    private parseIf() {
        this.writeOutput('<ifStatement>');

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
        if (tokenAhead && tokenAhead.value === 'else') {
            this.setNextToken();
            this.parseKeyword('else');

            this.setNextToken();
            this.parseSymbol('{');

            this.setNextToken();
            this.parseStatements();
            this.parseSymbol('}');
        }

        this.writeOutput('</ifStatement>');
    }

    private parseWhile() {
        this.writeOutput('<whileStatement>');

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

        this.writeOutput('</whileStatement>');
    }

    private parseDo() {
        this.writeOutput('<doStatement>');

        this.parseKeyword('do');

        this.setNextToken();
        this.parseSubroutineCall();

        this.setNextToken();
        this.parseSymbol(';');

        this.writeOutput('</doStatement>');
    }

    private parseReturn() {
        this.writeOutput('<returnStatement>');

        this.parseKeyword('return');

        this.setNextToken();
        if (this.token.value !== ';') {
            this.parseExpression();
        }

        this.parseSymbol(';');

        this.writeOutput('</returnStatement>');
    }

    /**
     * Parses expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpression() {
        this.writeOutput('<expression>');

        this.parseTerm();

        this.setNextToken();
        while (this.token.type === 'SYMBOL' && OPERATORS.includes(this.token.value as string)) {
            this.writeOutput();
            this.setNextToken();
            this.parseTerm();
            this.setNextToken();
        }

        this.writeOutput('</expression>');
    }

    private parseTerm() {
        this.writeOutput('<term>');

        switch (this.token.type) {
            case 'INT_CONST':
                this.parseInteger();
                break;
            case 'STRING_CONST':
                this.writeOutput();
                break;
            case 'KEYWORD':
                this.parseOneOfKeywords(KEYWORD_CONSTANTS);
                break;
            case 'IDENTIFIER':
                const tokenAhead: Token = this.tokenizer.lookAhead();

                if (tokenAhead && tokenAhead.value === '[') {
                    this.writeOutput();

                    this.setNextToken();
                    this.parseSymbol('[');

                    this.setNextToken();
                    this.parseExpression();

                    this.parseSymbol(']');
                } else if (tokenAhead && (tokenAhead.value === '(' || tokenAhead.value === '.')) {
                    this.parseSubroutineCall();
                } else {
                    this.writeOutput();
                }

                break;
            case 'SYMBOL':
                if (this.token.value === '(') {
                    this.parseSymbol('(');

                    this.setNextToken();
                    this.parseExpression();

                    this.parseSymbol(')');
                } else {
                    this.parseOneOfSymbols(UNARY_OPERATORS);
                    this.setNextToken();
                    this.parseTerm();
                }

                break;
        }

        this.writeOutput('</term>');
    }

    private parseSubroutineCall() {
        this.parseIdentifier();

        this.setNextToken();
        this.parseOneOfSymbols(['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.parseExpressionList();
            this.parseSymbol(')');
        } else {
            this.setNextToken();
            this.parseIdentifier();

            this.setNextToken();
            this.parseSymbol('(');

            this.setNextToken();
            this.parseExpressionList();
            this.parseSymbol(')');
        }
    }

    /**
     * Parses a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpressionList() {
        this.writeOutput('<expressionList>');

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseExpression();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another expression
            } else {
                closingBracketsReached = true; // expecting closing bracket (validated later in caller)
            }
        }

        this.writeOutput('</expressionList>');
    }
}
