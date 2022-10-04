import { Hash } from './hash';
import { IdentifierCategory, IdentifierContext } from './identifier';
import { TokenType } from './token';

export type NodeType =
    | TokenType
    | 'RETURN'
    | 'RETURN_TYPE'
    | 'SUBROUTINE_DEC'
    | 'SUBROUTINE_BODY'
    | 'SUBROUTINE_VAR_DEC'
    | 'PARAM_LIST'
    | 'CLASS_VAR_DEC'
    | 'STATEMENTS'
    | 'DO'
    | 'LET'
    | 'IF'
    | 'ELSE'
    | 'WHILE'
    | 'EXPRESSION'
    | 'EXPRESSION_LIST'
    | 'TERM'
    | 'VAR_DATA';

export type NodeValue = {
    type: NodeType;
    value?: string | number;
    category?: IdentifierCategory;
    context?: IdentifierContext;
    props?: Record<string, unknown>;
};

export class Node {
    key: string;
    children: Node[] = [];

    constructor(public value: NodeValue, public parent: string) {
        this.key = Hash.generate(JSON.stringify(this.value));
    }

    addChild(value: NodeValue): Node {
        const child = new Node(value, this.key);
        this.children.push(child);
        return child;
    }
}

export class Tree {
    root: Node;

    constructor(value: NodeValue) {
        this.root = new Node(value, null);
    }

    *traverse(node: Node): Generator<Node> {
        yield node;
        for (const child of node.children) {
            yield* this.traverse(child);
        }
    }

    findNode(key: string): Node | null {
        for (const node of this.traverse(this.root)) {
            if (node.key === key) {
                return node;
            }
        }

        return null;
    }
}
