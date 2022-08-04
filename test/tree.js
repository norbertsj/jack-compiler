const tree = {
    key: 1,
    value: {
        type: 'keyword',
        value: 'class',
    },
    parent: null,
    children: [
        {
            key: 2,
            value: {
                type: 'identifier',
                value: 'Main',
                category: 'class',
                context: 'declaration',
            },
            parent: 1,
            children: [],
        },
        {
            key: 3,
            value: {
                type: 'symbol',
                value: '{',
            },
            parent: 1,
            children: [],
        },
        {
            key: 4,
            value: {
                type: 'subroutineDec',
            },
            parent: 1,
            children: [
                {
                    key: 5,
                    value: {
                        type: 'keyword',
                        value: 'function',
                    },
                    parent: 4,
                    children: [],
                },
                {
                    key: 6,
                    value: {
                        type: 'keyword',
                        value: 'void',
                    },
                    parent: 4,
                    children: [],
                },
                {
                    key: 7,
                    value: {
                        type: 'identifier',
                        value: 'main',
                        category: 'subroutine',
                        context: 'declaration',
                    },
                    parent: 4,
                    children: [],
                },
            ],
        },
    ],
};
