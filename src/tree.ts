import { Hash } from './hash';

export class TreeNode<V> {
    key: string;
    children: TreeNode<V>[] = [];

    constructor(public value: V, public parent: string) {
        this.key = Hash.generate(JSON.stringify(this.value));
    }

    addChild(value: V): TreeNode<V> {
        const child = new TreeNode<V>(value, this.key);
        this.children.push(child);
        return child;
    }
}

export class Tree<V> {
    root: TreeNode<V>;

    constructor(value: V) {
        this.root = new TreeNode<V>(value, null);
    }

    *traverse(node: TreeNode<V>): Generator<TreeNode<V>> {
        yield node;
        for (const child of node.children) {
            yield* this.traverse(child);
        }
    }

    findNode(key: string): TreeNode<V> | null {
        for (const node of this.traverse(this.root)) {
            if (node.key === key) {
                return node;
            }
        }

        return null;
    }
}
