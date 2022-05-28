import { KEYWORD_CONSTANTS, OPERATORS, UNARY_OPERATORS } from './defines';
import Token from './token';
import Tokenizer from './tokenizer';
import Validator from './validator';
import { VariableKind, VariableTable } from './variable-table';

export default class Parser {
    private readonly tokenizer: Tokenizer;
    private token: Token;
    private output: string[] = [];
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
    }

    public parseClass(): void {
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

    private writeOutput(xmlString?: string): void {
        this.output.push(xmlString || this.token.xml);
    }

    private parseIdentifier(variable?: { type: string; kind: VariableKind }): void {
        Validator.validateIdentifier(this.token);
        let output = `
        <identifier>
            <isVariable>false</isVariable>
            <value>${this.token.value}</value>
        </identifier>
        `;
        if (variable) {
            const table = ['local', 'argument'].includes(variable.kind) ? 'subroutine' : 'class';
            const toAdd = { ...variable, name: this.token.value.toString() };
            const added = table === 'subroutine' ? this.subroutineVarTable.add(toAdd) : this.classVarTable.add(toAdd);
            output = `
            <identifier>
                <isVariable>true</isVariable>
                <value>${this.token.value}</value>
                <type>${variable.type}</type>
                <kind>${variable.kind}</kind>
                <varTable>${table}</varTable>
                <varTableIndex>${added.index}</varTableIndex>
            </identifier>`;
        }

        this.writeOutput(output);
    }

    private parseKeyword(keyword: string): void {
        Validator.validateKeyword(this.token, keyword);
        this.writeOutput();
    }

    private parseOneOfKeywords(keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeOutput();
    }

    private parseSymbol(symbol: string): void {
        Validator.validateSymbol(this.token, symbol);
        this.writeOutput();
    }

    private parseOneOfSymbols(symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeOutput();
    }

    private parseType(): void {
        Validator.validateType(this.token);
        this.writeOutput();
    }

    private parseSubroutineReturnType(): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeOutput();
    }

    private parseInteger(): void {
        Validator.validateIntegerValue(this.token);
        this.writeOutput();
    }

    private parseClassVarDec(): void {
        this.writeOutput('<classVarDec>');

        this.parseOneOfKeywords(['field', 'static']);
        const kind = this.token.value;
        this.setNextToken();
        this.parseVarDec(<VariableKind>kind);

        this.writeOutput('</classVarDec>');
    }

    private parseSubroutineDec(): void {
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
        this.subroutineVarTable.reset();
    }

    private parseParameterList(): void {
        this.writeOutput('<parameterList>');

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseParameter();
            this.setNextToken();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another parameter
            }
        }

        this.writeOutput('</parameterList>');
    }

    private parseParameter(): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier({ type, kind: 'argument' });
    }

    private parseSubroutineBody(): void {
        this.writeOutput('<subroutineBody>');

        this.parseSymbol('{');
        this.setNextToken();
        this.parseSubroutineVars();
        this.parseStatements();
        this.parseSymbol('}');

        this.writeOutput('</subroutineBody>');
    }

    private parseSubroutineVars(): void {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.parseSubroutineVarDec();
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec(): void {
        this.writeOutput('<varDec>');

        this.parseKeyword('var');
        this.setNextToken();
        this.parseVarDec('local');

        this.writeOutput('</varDec>');
    }

    /**
     * Parses "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec(kind: VariableKind): void {
        this.parseType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.parseIdentifier({ type, kind });

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                this.parseIdentifier({ type, kind });
                continue;
            }

            this.parseSymbol(';');
            semicolonReached = true;
        }
    }

    /**
     * Parses statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseStatements(): void {
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

    private parseLet(): void {
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

    private parseIf(): void {
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
        if (tokenAhead?.value === 'else') {
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

    private parseWhile(): void {
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

    private parseDo(): void {
        this.writeOutput('<doStatement>');

        this.parseKeyword('do');

        this.setNextToken();
        this.parseSubroutineCall();

        this.setNextToken();
        this.parseSymbol(';');

        this.writeOutput('</doStatement>');
    }

    private parseReturn(): void {
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
    private parseExpression(): void {
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

    private parseTerm(): void {
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

                if (tokenAhead?.value === '[') {
                    this.writeOutput();

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

                this.writeOutput();
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

        this.writeOutput('</term>');
    }

    private parseSubroutineCall(): void {
        this.parseIdentifier();

        this.setNextToken();
        this.parseOneOfSymbols(['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.parseExpressionList();
            this.parseSymbol(')');
            return;
        }

        this.setNextToken();
        this.parseIdentifier();

        this.setNextToken();
        this.parseSymbol('(');

        this.setNextToken();
        this.parseExpressionList();
        this.parseSymbol(')');
    }

    /**
     * Parses a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private parseExpressionList(): void {
        this.writeOutput('<expressionList>');

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.parseExpression();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another expression
            }
        }

        this.writeOutput('</expressionList>');
    }
}
