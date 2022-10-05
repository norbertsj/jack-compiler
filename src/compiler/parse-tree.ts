import { Tree, TreeNode } from '../tree';
import { IdentifierCategory, IdentifierContext, LexicalElement, ParseTreeElement } from './defines';

export type ParseTreeNodeType = LexicalElement | ParseTreeElement;

export type ParseTreeNodeValue = {
    type: ParseTreeNodeType;
    value?: string | number;
    category?: IdentifierCategory;
    context?: IdentifierContext;
    props?: Record<string, unknown>;
};

export class ParseTreeNode extends TreeNode<ParseTreeNodeValue> {
    constructor(value: ParseTreeNodeValue, parent: string) {
        super(value, parent);
    }
}

export class ParseTree extends Tree<ParseTreeNodeValue> {
    constructor(value: ParseTreeNodeValue) {
        super(value);
    }
}
