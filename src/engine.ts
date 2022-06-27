import { CompilerOutput } from './compiler';
import {
    IdentifierCategory,
    IdentifierContext,
    INDENT_SIZE,
    KEYWORD_CONSTANTS,
    OPERATORS,
    UNARY_OPERATORS,
} from './defines';
import { Token } from './token';
import { Tokenizer } from './tokenizer';
import { Validator } from './validator';
import { VariableKind, VariableTable } from './variable-table';
import { VMWriter } from './vm-writer';

export class CompilationEngine {
    private readonly tokenizer: Tokenizer;
    private readonly vmWriter: VMWriter;
    private token: Token;
    private output: CompilerOutput = { tokens: [], xml: [], vm: [] };
    private classVarTable: VariableTable;
    private subroutineVarTable: VariableTable;
    private indent = 0;

    constructor(input: string[]) {
        this.tokenizer = new Tokenizer(input);
        this.vmWriter = new VMWriter();
        this.classVarTable = new VariableTable();
        this.subroutineVarTable = new VariableTable();
    }

    compile(): void {
        this.output.tokens = this.tokenizer.getTokens();

        this.writeXML('<class>');
        this.increaseIndent();

        this.setNextToken();
        this.compileKeyword('class');

        this.setNextToken();
        this.compileIdentifier('class', 'declaration');

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
        this.writeXML('</class>');
    }

    getOutput(): CompilerOutput {
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

        this.output.xml.push(out);
    }

    private compileIdentifier(
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

    private compileKeyword(keyword: string): void {
        Validator.validateKeyword(this.token, keyword);
        this.writeXML();
    }

    private compileOneOfKeywords(keywords: string[]): void {
        Validator.validateKeywords(this.token, keywords);
        this.writeXML();
    }

    private compileSymbol(symbol: string): void {
        Validator.validateSymbol(this.token, symbol);
        this.writeXML();
    }

    private compileOneOfSymbols(symbols: string[]): void {
        Validator.validateSymbols(this.token, symbols);
        this.writeXML();
    }

    private compileType(): void {
        Validator.validateType(this.token);
        this.writeXML();
    }

    private compileSubroutineReturnType(): void {
        Validator.validateSubroutineReturnType(this.token);
        this.writeXML();
    }

    private compileInteger(): void {
        Validator.validateIntegerValue(this.token);
        this.writeXML();
    }

    private compileClassVarDec(): void {
        this.writeXML('<classVarDec>');
        this.increaseIndent();

        this.compileOneOfKeywords(['field', 'static']);
        const kind = this.token.value;
        this.setNextToken();
        this.compileVarDec(<VariableKind>kind);

        this.decreaseIndent();
        this.writeXML('</classVarDec>');
    }

    private compileSubroutineDec(): void {
        this.writeXML('<subroutineDec>');
        this.increaseIndent();

        this.compileOneOfKeywords(['constructor', 'method', 'function']);

        this.setNextToken();
        this.compileSubroutineReturnType();

        this.setNextToken();
        this.compileIdentifier('subroutine', 'declaration');

        this.setNextToken();
        this.compileSymbol('(');

        this.setNextToken();
        this.compileParameterList();
        this.compileSymbol(')');

        this.setNextToken();
        this.compileSubroutineBody();

        this.decreaseIndent();
        this.writeXML('</subroutineDec>');
        this.subroutineVarTable.reset();
    }

    private compileParameterList(): void {
        this.writeXML('<parameterList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.compileParameter();
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

    private compileParameter(): void {
        this.compileType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.compileIdentifier('variable', 'usage', { type, kind: 'argument' });
    }

    private compileSubroutineBody(): void {
        this.writeXML('<subroutineBody>');
        this.increaseIndent();

        this.compileSymbol('{');
        this.setNextToken();
        this.compileSubroutineVars();
        this.compileStatements();
        this.compileSymbol('}');

        this.decreaseIndent();
        this.writeXML('</subroutineBody>');
    }

    private compileSubroutineVars(): void {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.compileSubroutineVarDec();
            this.setNextToken();
        }
    }

    private compileSubroutineVarDec(): void {
        this.writeXML('<varDec>');
        this.increaseIndent();

        this.compileKeyword('var');
        this.setNextToken();
        this.compileVarDec('local');

        this.decreaseIndent();
        this.writeXML('</varDec>');
    }

    /**
     * compiles "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private compileVarDec(kind: VariableKind): void {
        this.compileType();
        const type = this.token.value.toString();
        this.setNextToken();
        this.compileIdentifier('variable', 'declaration', { type, kind });

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeXML();
                this.setNextToken();
                this.compileIdentifier('variable', 'declaration', { type, kind });
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
        this.writeXML('<statements>');
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
        this.writeXML('</statements>');
    }

    private compileLet(): void {
        this.writeXML('<letStatement>');
        this.increaseIndent();
        this.compileKeyword('let');

        this.setNextToken();
        this.compileIdentifier('variable', 'definition');

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
        this.writeXML('</letStatement>');
    }

    private compileIf(): void {
        this.writeXML('<ifStatement>');
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
        this.writeXML('</ifStatement>');
    }

    private compileWhile(): void {
        this.writeXML('<whileStatement>');
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
        this.writeXML('</whileStatement>');
    }

    private compileDo(): void {
        this.writeXML('<doStatement>');
        this.increaseIndent();

        this.compileKeyword('do');

        this.setNextToken();
        this.compileSubroutineCall();

        this.setNextToken();
        this.compileSymbol(';');

        this.decreaseIndent();
        this.writeXML('</doStatement>');
    }

    private compileReturn(): void {
        this.writeXML('<returnStatement>');
        this.increaseIndent();

        this.compileKeyword('return');

        this.setNextToken();
        if (this.token.value !== ';') {
            this.compileExpression();
        }

        this.compileSymbol(';');

        this.decreaseIndent();
        this.writeXML('</returnStatement>');
    }

    /**
     * compiles expression
     * (after execution the "setNextToken" method call is not needed)
     */
    private compileExpression(): void {
        this.writeXML('<expression>');
        this.increaseIndent();

        this.compileTerm();

        this.setNextToken();
        while (this.token.type === 'SYMBOL' && OPERATORS.includes(this.token.value as string)) {
            this.writeXML();
            this.setNextToken();
            this.compileTerm();
            this.setNextToken();
        }

        this.decreaseIndent();
        this.writeXML('</expression>');
    }

    private compileTerm(): void {
        this.writeXML('<term>');
        this.increaseIndent();

        switch (this.token.type) {
            case 'INT_CONST':
                this.compileInteger();
                break;
            case 'STRING_CONST':
                this.writeXML();
                break;
            case 'KEYWORD':
                this.compileOneOfKeywords(KEYWORD_CONSTANTS);
                break;
            case 'IDENTIFIER':
                const tokenAhead: Token = this.tokenizer.lookAhead();

                if (tokenAhead?.value === '[') {
                    this.writeXML();

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

                this.writeXML();
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
        this.writeXML('</term>');
    }

    private compileSubroutineCall(): void {
        const tokenAhead: Token = this.tokenizer.lookAhead();
        const category = tokenAhead.value === '(' ? 'subroutine' : 'class';
        this.compileIdentifier(category, 'usage');

        this.setNextToken();
        this.compileOneOfSymbols(['(', '.']);

        if (this.token.value === '(') {
            this.setNextToken();
            this.compileExpressionList();
            this.compileSymbol(')');
            return;
        }

        this.setNextToken();
        this.compileIdentifier('subroutine', 'usage');

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
        this.writeXML('<expressionList>');
        this.increaseIndent();

        let closingBracketsReached: boolean = this.token.type === 'SYMBOL' && this.token.value === ')';
        while (!closingBracketsReached) {
            this.compileExpression();
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
}
