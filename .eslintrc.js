module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json'],
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
    ],
    rules: {
        '@typescript-eslint/restrict-template-expressions': 'off',
        'no-useless-escape': 'off',
        '@typescript-eslint/explicit-function-return-type': 'error',
    },
};
