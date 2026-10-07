import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-config-prettier';

/**
 * Base configuration — enforces docs/rules/00-nguyen-tac-chung.md and 01-typescript.md.
 * Each rule below is annotated with the rule section it enforces.
 */
export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: { import: importPlugin, unicorn },
    languageOptions: {
      parserOptions: { projectService: true },
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['./tsconfig.json'] },
      },
    },
    rules: {
      // ---- 01-typescript.md section C: type usage rules ----
      '@typescript-eslint/no-explicit-any': 'error', // C1
      '@typescript-eslint/no-unsafe-assignment': 'error', // C1
      '@typescript-eslint/no-unsafe-member-access': 'error', // C1
      '@typescript-eslint/no-unsafe-call': 'error', // C1
      '@typescript-eslint/no-unsafe-return': 'error', // C1
      '@typescript-eslint/consistent-type-assertions': [
        // C2
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // C3
      '@typescript-eslint/explicit-module-boundary-types': 'error', // C4
      '@typescript-eslint/consistent-type-imports': [
        // C6
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error', // C8

      // ---- 01-typescript.md section A: path aliases ----
      'no-restricted-imports': [
        // A1
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*'],
              message:
                'Use a path alias (@/... or @repo/...) instead of a parent-relative path. See docs/rules/01-typescript.md section A1.',
            },
          ],
        },
      ],
      'import/no-unresolved': 'error', // A3
      'import/no-cycle': ['error', { maxDepth: Infinity }], // 00 section F3
      'import/order': [
        // A5
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            { pattern: '@repo/**', group: 'internal', position: 'before' },
            { pattern: '@/**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // ---- 00-nguyen-tac-chung.md section B: naming ----
      'unicorn/filename-case': [
        // B2
        'error',
        { cases: { kebabCase: true, pascalCase: true } },
      ],
      '@typescript-eslint/naming-convention': [
        // B2
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false }, // no I prefix
        },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],

      // ---- 00-nguyen-tac-chung.md section C: readability ----
      'max-depth': 'off', // C1
      complexity: 'off', // C1
      'no-magic-numbers': 'off', // C2
      'prefer-const': 'error', // C3
      'no-param-reassign': ['error', { props: true }], // C3
      'max-params': 'off', // C5

      // ---- 00-nguyen-tac-chung.md section D: comments ----
      'no-warning-comments': [
        // D2
        'warn',
        { terms: ['todo', 'fixme'], location: 'start' },
      ],

      // ---- 00-nguyen-tac-chung.md section E: error handling ----
      'no-empty': ['error', { allowEmptyCatch: false }], // E1
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error', // E2

      // ---- 00-nguyen-tac-chung.md section F: file structure ----
      'max-lines': 'off', // F4
      'max-lines-per-function': 'off',

      'no-console': 'error',
    },
  },
  {
    // Relaxed for tests: fixtures need magic numbers and type assertions
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/test/**'],
    rules: {
      'no-magic-numbers': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);

export default base;
