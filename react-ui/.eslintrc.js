module.exports = {
    extends: ['react-app', 'react-app/jest'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
    },
    plugins: ['testing-library', '@typescript-eslint'],
    rules: {},
    settings: {
        react: {
            version: 'detect',
        },
    },
}
