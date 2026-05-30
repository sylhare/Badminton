import { fixupPluginRules } from '@eslint/compat';
import stylisticPlugin from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import-x';
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
      '@stylistic': stylisticPlugin,
      'import-x': importPlugin,
      'unused-imports': unusedImportsPlugin,
      'react': fixupPluginRules(reactPlugin),
      '@typescript-eslint': typescriptEslint.plugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1, 'maxBOF': 0 }],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/quotes': ['error', 'single', { 'allowTemplateLiterals': 'always' }],
      'no-unneeded-ternary': 'error',
      'no-nested-ternary': 'error',
      'no-irregular-whitespace': 'error',
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
      'import-x/order': [
        'error',
        {
          'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import-x/newline-after-import': ['error', { 'count': 1 }],
      ...reactPlugin.configs.recommended.rules,
      'react/jsx-tag-spacing': ['error', { 'beforeSelfClosing': 'always' }],
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
