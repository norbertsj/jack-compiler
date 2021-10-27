import Tokenizer from './tokenizer';
import Token from './token';
import Validator from './validator';

/**
 * PROGRAM STRUCTURE
 * class: 'class' className '{' classVarDec* subroutineDec* '}'
 * classVarDec: ('static'|'field') type varName (','varName)* ';'
 * type: 'int'|'char'|'boolean'|className
 * subroutineDec: ('constructor'|'function'|'method') ('void'|type) subroutineName
 *     '(' parameterList ')' subroutineBody
 * parameterList: ( (type varName) (','type varName)*)?
 * subroutineBody: '{' varDec* statements '}'
 * varDec: 'var' type varName (','varName)* ';'
 * className: identifier
 * subroutineName: identifier
 * varName: identifier
 *
 * STATEMENTS
 * statements: statement*
 * statement: letStatement|ifStatement|whileStatement|doStatement|returnStatement
 * letStatment: 'let' varName ('[' expression ']')? '=' expression ';'
 * ifStatement: 'if' '(' expression ')' '{' statements '}' ('else' '{' statements '}')?
 * whileStatement: 'while' '(' expression ')' '{' statements '}'
 * doStatement: 'do' subroutineCall ';'
 * returnStatement: 'return' expression? ';'
 *
 * EXPRESSIONS
 * expression: term (op term)*
 * term: integerConstant|stringConstant|keywordConstant|varName|varName '[' expression ']'
 *     | subroutineCall|'(' expression ')'|unaryOp term
 * subroutineCall: subroutineName '(' expressionList ')'|(className|varName)'.'subroutineName '(' expressionList ')'
 * expressionList: (expression (','expression)*)?
 * op: '+'|'-'|'*'|'/'|'&'|'|'|'<'|'>'|'='
 * unaryOp: '-'|'~'
 * keywordConstant: 'true'|'false'|'null'|'this'
 */

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
        this.parseClassKeyword();

        this.setNextToken();
        this.parseIdentifier();

        this.setNextToken();
        this.parseBlockBracketsOpen();

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
                    this.parseBlockBracketsClose();
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

    private parseClassKeyword() {
        Validator.validateClassKeyword(this.token);
        this.writeOutput();
    }

    private parseIdentifier() {
        Validator.validateIdentifier(this.token);
        this.writeOutput();
    }

    private parseBlockBracketsOpen() {
        Validator.validateBlockBracketsOpen(this.token);
        this.writeOutput();
    }

    private parseBlockBracketsClose() {
        Validator.validateBlockBracketsClose(this.token);
        this.writeOutput();
    }

    private parseBracketsOpen() {
        Validator.validateBlockBracketsOpen(this.token);
        this.writeOutput();
    }

    private parseBracketsClose() {
        Validator.validateBracketsClose(this.token);
        this.writeOutput();
    }

    private parseClassVarDec() {
        Validator.validateClassVarScope(this.token);
        this.writeOutput('<classVarDec>');
        this.writeOutput();

        this.setNextToken();
        this.parseVarDec();

        this.writeOutput('</classVarDec>');
    }

    private parseSubroutineDec() {
        Validator.validateSubroutineType(this.token);
        this.writeOutput('<subroutineDec>');
        this.writeOutput();

        this.setNextToken();
        Validator.validateSubroutineReturnType(this.token);
        this.writeOutput();

        this.setNextToken();
        Validator.validateIdentifier(this.token);
        this.writeOutput();

        this.setNextToken();
        this.parseBracketsOpen();

        this.setNextToken();
        this.parseParameterList();
        this.parseBracketsClose();

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
        Validator.validateType(this.token);
        this.writeOutput();

        this.setNextToken();
        Validator.validateIdentifier(this.token);
        this.writeOutput();
    }

    private parseSubroutineBody() {
        this.writeOutput('<subroutineBody>');
        this.parseBlockBracketsOpen();

        this.setNextToken();
        this.parseSubroutineVars();
        this.parseStatements();

        this.parseBlockBracketsClose();
        this.output.push('</subroutineBody>');
    }

    private parseSubroutineVars() {
        while (this.token.type === 'KEYWORD' && this.token.value === 'var') {
            this.parseSubroutineVarDec();
            this.setNextToken();
        }
    }

    private parseSubroutineVarDec() {
        Validator.validateSubroutineVarScope(this.token);
        this.writeOutput('<varDec>');
        this.writeOutput();

        this.setNextToken();
        this.parseVarDec();

        this.writeOutput('</varDec>');
    }

    /**
     * Parses "type varName (','varName)* ';'"
     * which is used in "classVarDec" and "varDec" rule structures
     */
    private parseVarDec() {
        Validator.validateType(this.token);
        this.writeOutput();

        this.setNextToken();
        Validator.validateIdentifier(this.token);
        this.writeOutput();

        let semicolonReached: boolean = false;
        while (!semicolonReached) {
            this.setNextToken();

            if (this.token.type === 'SYMBOL' && this.token.value === ',') {
                this.writeOutput();
                this.setNextToken();
                Validator.validateIdentifier(this.token);
                this.writeOutput();
            } else {
                Validator.validateSemicolon(this.token);
                this.writeOutput();
                semicolonReached = true;
            }
        }
    }

    private parseStatements() {
        // parses a sequence of statements (does not handle enclosing "{}")
    }

    private parseLet() {
        // parses a let statement
    }

    private parseIf() {
        // parses an if statement (possibly with a traling else clause)
    }

    private parseWhile() {
        // parses while statement
    }

    private parseDo() {
        // parses do statement
    }

    private parseReturn() {
        // parses return statement
    }

    private parseExpression() {
        // parses expression
    }

    private parseTerm() {
        // parses a term (can use tokenizer.lookAhead for to distinguish between variable, array or subroutine call)
    }

    private parseExpressionList() {
        // parses a (possibly empty) comma-separated list of expressions
    }
}
