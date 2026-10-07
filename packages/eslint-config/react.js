import boundaries from 'eslint-plugin-boundaries';
import a11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/**
 * Enforces docs/rules/04-frontend-react.md.
 */
export const reactConfig = tseslint.config(
  ...base,
  {
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': a11y, boundaries },
    settings: {
      react: { version: 'detect' },
      'boundaries/elements': [
        { type: 'config', pattern: 'src/config/**' },
        { type: 'lib', pattern: 'src/lib/**' },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'entities', pattern: 'src/entities/*', capture: ['name'] },
        { type: 'features', pattern: 'src/features/*', capture: ['name'] },
        { type: 'app', pattern: 'src/app/**' },
      ],
      'boundaries/include': ['src/**/*.ts', 'src/**/*.tsx'],
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,

      // ---- A1: dependency direction ----
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            'Boundary violation: ${file.type} may not import from ${dependency.type}. See docs/rules/04-frontend-react.md section A1.',
          rules: [
            { from: 'config', allow: [] },
            { from: 'lib', allow: ['config'] },
            { from: 'shared', allow: ['config', 'lib'] },
            { from: 'entities', allow: ['config', 'lib', 'shared'] },
            { from: 'features', allow: ['config', 'lib', 'shared', 'entities', 'features'] },
            { from: 'app', allow: ['config', 'lib', 'shared', 'entities', 'features'] },
          ],
        },
      ],
      // ---- A2: features are only reachable through index.ts ----
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          message:
            'Import another feature only through its public index.ts. See docs/rules/04-frontend-react.md section A2.',
          rules: [
            { target: ['features', 'entities'], allow: 'index.ts' },
            { target: ['shared', 'lib', 'config'], allow: '**' },
          ],
        },
      ],

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-array-index-key': 'error', // B5
      'react/jsx-no-useless-fragment': 'warn',
      'react-hooks/exhaustive-deps': 'error', // rules 00, section C3
      'max-lines': 'off', // B2
    },
  },
  {
    // React components return JSX by convention; keeping the annotation on every
    // component adds noise while TypeScript still checks the rendered tree.
    files: ['src/**/*.tsx'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
  {
    // ---- D1: every API call goes through lib/http ----
    files: ['src/features/**', 'src/entities/**', 'src/shared/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use the client in @/lib/http so auth headers and token refresh are applied.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use the client in @/lib/http.' }],
          patterns: [{ group: ['../*', '../../*'], message: 'Use a path alias (@/...).' }],
        },
      ],
    },
  },
  {
    // ---- A4: shared/ui must stay free of domain logic ----
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'axios', message: 'Use the client in @/lib/http.' }],
          patterns: [
            { group: ['../*', '../../*'], message: 'Use a path alias (@/...).' },
            {
              group: ['@/features/*', '@/entities/*'],
              message:
                'shared/ must not know about the domain. See docs/rules/04-frontend-react.md section A4.',
            },
          ],
        },
      ],
    },
  },
  {
    // shadcn primitives are CLI-generated code; size rules do not apply
    files: ['src/shared/ui/**'],
    rules: { 'max-lines': 'off', '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
);

export default reactConfig;
