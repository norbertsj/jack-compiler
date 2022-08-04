import { Hash } from './hash';

export type NodeValue = {
    type: string;
    value?: string | number;
    category?: string;
    context?: string;
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

// const tree = new Tree('subroutine');
// tree.root.addChild('type');
// tree.root.addChild('returnType');
// tree.root.addChild('name');
// const statements = tree.root.addChild('statements');
// const subCall = statements.addChild('call Output.printString');
// const expr = subCall.addChild('expression');
// expr.addChild('1');
// expr.addChild('+');
// expr.addChild('3');

// for (const output of tree.traverse(tree.root)) {
//     console.log(output.key, output.value);
// }

// console.log('lets see if we can find expression node, key =', expr.key);
// console.log(tree.findNode(expr.key));
