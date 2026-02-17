import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import reactPlugin from 'eslint-plugin-react';
import typescriptEslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/dist', '**/coverage', '**/node_modules', '**/.venv', '**/playwright-report', '**/test-results'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['build', 'public/build'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'import': importPlugin,
      'unused-imports': unusedImportsPlugin,
      'react': reactPlugin,
      '@typescript-eslint': typescriptEslint.plugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'no-extra-semi': 'error',
      'no-unneeded-ternary': 'error',
      'no-nested-ternary': 'error',
      'no-trailing-spaces': 'error',
      'no-irregular-whitespace': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1, 'maxBOF': 0 }],
      'array-bracket-spacing': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'import/order': [
        'error',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/newline-after-import': ['error', { 'count': 1 }],
      ...reactPlugin.configs.recommended.rules,
      'react/jsx-tag-spacing': ['error', { 'beforeSelfClosing': 'always' }],
    },
  },
];
