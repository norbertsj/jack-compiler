import { INDENT_SIZE, KEYWORD_CONSTANTS, OPERATORS, UNARY_OPERATORS } from './defines';
import { Token } from './token';
import { Tokenizer } from './tokenizer';
import { Validator } from './validator';
import { VariableKind, VariableTable } from './variable-table';
import { VMWriter } from './vm-writer';

export class CompilationEngine {
    private readonly tokenizer: Tokenizer;
    private readonly vmWriter: VMWriter;
    private token: Token;
    private output: string[] = [];
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;
    private indent = 0;

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
        this.vmWriter = new VMWriter();
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
    }

    compileClass(): void {
        this.writeOutput('<class>');
        this.increaseIndent();

        this.setNextToken();
        this.compileKeyword('class');

        this.setNextToken();
        this.compileIdentifier();

        this.setNextToken();
        this.compileSymbol('{');

        while (this.tokenizer.hasMoreTokens()) {
            this.setNextToken();

            switch (this.token.value) {
                case 'static':
                case 'field':
                    this.compileClassVarDec();
                    break;
                case 'constructor':
                case 'function':
                case 'method':
                    this.compileSubroutineDec();
                    break;
                default:
                    this.compileSymbol('}');
                    break;
            }
        }

        this.decreaseIndent();
        this.writeOutput('</class>');
    }

    getOutput(): string[] {
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

    private writeOutput(xmlString: string = undefined): void {
        let out = xmlString || this.token.xml;

        if (this.indent > 0) {
            out = out.padStart(out.length + this.indent * INDENT_SIZE);
        }

        this.output.push(out);
    }

    private compileIdentifier(variable?: { type: string; kind: VariableKind }): void {
        Validator.validateIdentifier(this.token);

        if (variable) {
            const table = ['local', 'argument'].includes(variable.kind) ? 'subroutine' : 'class';
            const toAdd = { ...variable, name: this.token.value.toString() };
            const added = table === 'subroutine' ? this.subroutineVarTable.add(toAdd) : this.classVarTable.add(toAdd);

            this.writeOutput('<identifier>');
            this.increaseIndent();

            this.writeOutput('<isVariable>true</isVariable>');
            this.writeOutput(`<value>${this.token.value}</value>`);
            this.writeOutput(`<type>${variable.type}</type>`);
            this.writeOutput(`<kind>${variable.kind}</kind>`);
            this.writeOutput(`<varTable>${table}</varTable>`);
            this.writeOutput(`<varTableIndex>${added.index}</varTableIndex>`);

            this.decreaseIndent();
            this.writeOutput('</identifier>');

            return;
        }

        this.writeOutput('<identifier>');
        this.increaseIndent();

        this.writeOutput('<isVariable>false</isVariable>');
        this.writeOutput(`<value>${this.token.value}</value>`);

        this.decreaseIndent();
        this.writeOutput('</identifier>');
    }

    private compileKeyword(keyword: string): void {
        Validator.validateKeyword(this.token, keyword);
        this.writeOutput();
    }

    private compileOneOfKeywords(keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeOutput();
    }

    private compileSymbol(symbol: string): void {
        Validator.validateSymbol(this.token, symbol);
        this.writeOutput();
    }

    private compileOneOfSymbols(symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeOutput();
    }

    private compileType(): void {
        Validator.validateType(this.token);
        this.writeOutput();
    }

    private compileSubroutineReturnType(): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeOutput();
    }

    private compileInteger(): void {
        Validator.validateIntegerValue(this.token);
        this.writeOutput();
    }

    private compileClassVarDec(): void {
        this.writeOutput('<classVarDec>');
        this.increaseIndent();

        this.compileOneOfKeywords(['field', 'static']);
        const kind = this.token.value;
        this.setNextToken();
        this.compileVarDec(<VariableKind>kind);

        this.decreaseIndent();
        this.writeOutput('</classVarDec>');
    }

    private compileSubroutineDec(): void {
        this.writeOutput('<subroutineDec>');
        this.increaseIndent();

        this.compileOneOfKeywords(['constructor', 'method', 'function']);

        this.setNextToken();
        this.compileSubroutineReturnType();

        this.setNextToken();
        this.compileIdentifier();

        this.setNextToken();
        this.compileSymbol('(');

        this.setNextToken();
        this.compileParameterList();
        this.compileSymbol(')');

        this.setNextToken();
        this.compileSubroutineBody();

        this.decreaseIndent();
        this.writeOutput('</subroutineDec>');
        this.subroutineVarTable.reset();
    }

    private compileParameterList(): void {
        this.writeOutput('<parameterList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.compileParameter();
            this.setNextToken();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another parameter
            }
        }

        this.decreaseIndent();
        this.writeOutput('</parameterList>');
    }

    private compileParameter(): void {
        this.compileType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.compileIdentifier({ type, kind: 'argument' });
    }

    private compileSubroutineBody(): void {
        this.writeOutput('<subroutineBody>');
        this.increaseIndent();

        this.compileSymbol('{');
        this.setNextToken();
        this.compileSubroutineVars();
        this.compileStatements();
        this.compileSymbol('}');

        this.decreaseIndent();
        this.writeOutput('</subroutineBody>');
    }

    private compileSubroutineVars(): void {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.compileSubroutineVarDec();
            this.setNextToken();
        }
    }

    private compileSubroutineVarDec(): void {
        this.writeOutput('<varDec>');
        this.increaseIndent();

        this.compileKeyword('var');
        this.setNextToken();
        this.compileVarDec('local');

        this.decreaseIndent();
        this.writeOutput('</varDec>');
    }

    /**
     * compiles "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private compileVarDec(kind: VariableKind): void {
        this.compileType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.compileIdentifier({ type, kind });

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                this.compileIdentifier({ type, kind });
                continue;
            }

            this.compileSymbol(';');
            semicolonReached = true;
        }
    }

    /**
     * compiles statements
     * (after execution the "setNextToken" method call is not needed)
     */
    private compileStatements(): void {
        this.writeOutput('<statements>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === '}';
        while (!closingBracketsReached) {
            switch (this.token.value) {
                case 'let':
                    this.compileLet();
                    break;
                case 'if':
                    this.compileIf();
                    break;
                case 'while':
                    this.compileWhile();
                    break;
                case 'do':
                    this.compileDo();
                    break;
                case 'return':
                    this.compileReturn();
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
        this.writeOutput('</statements>');
    }

    private compileLet(): void {
        this.writeOutput('<letStatement>');
        this.increaseIndent();
        this.compileKeyword('let');

        this.setNextToken();
        this.compileIdentifier();

        this.setNextToken();
        if (this.token.value !== '=') {
            this.compileSymbol('[');

            this.setNextToken();
            this.compileExpression();
            this.compileSymbol(']');

            this.setNextToken();
        }

        this.compileSymbol('=');

        this.setNextToken();
        this.compileExpression();
        this.compileSymbol(';');

        this.decreaseIndent();
        this.writeOutput('</letStatement>');
    }

    private compileIf(): void {
        this.writeOutput('<ifStatement>');
        this.increaseIndent();

        this.compileKeyword('if');

        this.setNextToken();
        this.compileSymbol('(');

        this.setNextToken();
        this.compileExpression();
        this.compileSymbol(')');

        this.setNextToken();
        this.compileSymbol('{');

        this.setNextToken();
        this.compileStatements();
        this.compileSymbol('}');

        const tokenAhead: Token = this.tokenizer.lookAhead();
        if (tokenAhead?.value === 'else') {
            this.setNextToken();
            this.compileKeyword('else');

            this.setNextToken();
            this.compileSymbol('{');

            this.setNextToken();
            this.compileStatements();
            this.compileSymbol('}');
        }

        this.decreaseIndent();
        this.writeOutput('</ifStatement>');
    }

    private compileWhile(): void {
        this.writeOutput('<whileStatement>');
        this.increaseIndent();

        this.compileKeyword('while');

        this.setNextToken();
        this.compileSymbol('(');

        this.setNextToken();
        this.compileExpression();
        this.compileSymbol(')');

        this.setNextToken();
        this.compileSymbol('{');

        this.setNextToken();
        this.compileStatements();
        this.compileSymbol('}');

        this.decreaseIndent();
        this.writeOutput('</whileStatement>');
    }

    private compileDo(): void {
        this.writeOutput('<doStatement>');
        this.increaseIndent();

        this.compileKeyword('do');

        this.setNextToken();
        this.compileSubroutineCall();

        this.setNextToken();
        this.compileSymbol(';');

        this.decreaseIndent();
        this.writeOutput('</doStatement>');
    }

    private compileReturn(): void {
        this.writeOutput('<returnStatement>');
        this.increaseIndent();

        this.compileKeyword('return');

        this.setNextToken();
        if (this.token.value !== ';') {
            this.compileExpression();
        }

        this.compileSymbol(';');

        this.decreaseIndent();
        this.writeOutput('</returnStatement>');
    }

    /**
     * compiles expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private compileExpression(): void {
        this.writeOutput('<expression>');
        this.increaseIndent();

        this.compileTerm();

        this.setNextToken();
        while (this.token.type === 'SYMBOL' && OPERATORS.includes(this.token.value as string)) {
            this.writeOutput();
            this.setNextToken();
            this.compileTerm();
            this.setNextToken();
        }

        this.decreaseIndent();
        this.writeOutput('</expression>');
    }

    private compileTerm(): void {
        this.writeOutput('<term>');
        this.increaseIndent();

        switch (this.token.type) {
            case 'INT_CONST':
                this.compileInteger();
                break;
            case 'STRING_CONST':
                this.writeOutput();
                break;
            case 'KEYWORD':
                this.compileOneOfKeywords(KEYWORD_CONSTANTS);
                break;
            case 'IDENTIFIER':
                const tokenAhead: Token = this.tokenizer.lookAhead();

                if (tokenAhead?.value === '[') {
                    this.writeOutput();

                    this.setNextToken();
                    this.compileSymbol('[');

                    this.setNextToken();
                    this.compileExpression();

                    this.compileSymbol(']');
                    break;
                }

                if (tokenAhead?.value === '(' || tokenAhead?.value === '.') {
                    this.compileSubroutineCall();
                    break;
                }

                this.writeOutput();
                break;
            case 'SYMBOL':
                if (this.token.value === '(') {
                    this.compileSymbol('(');

                    this.setNextToken();
                    this.compileExpression();

                    this.compileSymbol(')');
                    break;
                }

                this.compileOneOfSymbols(UNARY_OPERATORS);
                this.setNextToken();
                this.compileTerm();
                break;
        }

        this.decreaseIndent();
        this.writeOutput('</term>');
    }

    private compileSubroutineCall(): void {
        this.compileIdentifier();

        this.setNextToken();
        this.compileOneOfSymbols(['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.compileExpressionList();
            this.compileSymbol(')');
            return;
        }

        this.setNextToken();
        this.compileIdentifier();

        this.setNextToken();
        this.compileSymbol('(');

        this.setNextToken();
        this.compileExpressionList();
        this.compileSymbol(')');
    }

    /**
     * compiles a list of comma separated expressions
     * (after execution the "setNextToken" method call is not needed)
     */
    private compileExpressionList(): void {
        this.writeOutput('<expressionList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.compileExpression();
            closingBracketsReached = true; // by default expecting closing bracket (validated later in caller)

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                closingBracketsReached = false; // expecting another expression
            }
        }

        this.decreaseIndent();
        this.writeOutput('</expressionList>');
    }
}
