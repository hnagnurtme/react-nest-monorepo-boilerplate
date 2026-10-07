import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/**
 * Enforces docs/rules/02-backend-nestjs.md — the five-layer boundaries and apps/api-specific rules.
 */
export const nest = tseslint.config(
  ...base,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'config', pattern: 'src/config/**' },
        { type: 'common', pattern: 'src/common/**' },
        { type: 'core', pattern: 'src/core/**' },
        { type: 'integrations', pattern: 'src/integrations/**' },
        { type: 'modules', pattern: 'src/modules/*', capture: ['moduleName'] },
      ],
      'boundaries/include': ['src/**/*.ts'],
    },
    rules: {
      // ---- A1: dependencies may only flow in one direction ----
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            'Layer boundary violation: ${file.type} may not import from ${dependency.type}. See docs/rules/02-backend-nestjs.md section A1.',
          rules: [
            { from: 'config', allow: [] },
            { from: 'common', allow: ['config'] },
            { from: 'core', allow: ['config', 'common'] },
            { from: 'integrations', allow: ['config', 'common', 'core'] },
            { from: 'modules', allow: ['config', 'common', 'core', 'integrations', 'modules'] },
          ],
        },
      ],
      // ---- A3 / F2: other modules are only reachable through index.ts ----
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          message:
            'Import another module only through its public index.ts. See docs/rules/02-backend-nestjs.md section A3.',
          rules: [
            // Only the modules layer is restricted to index.ts; infrastructure layers import freely.
            { target: ['config', 'common', 'core', 'integrations'], allow: '**' },
            { target: ['modules'], allow: 'index.ts' },
          ],
        },
      ],
    },
  },
  {
    // ---- A2: no outbound HTTP calls from the modules layer ----
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'axios', message: 'External systems must be called through an adapter in src/integrations/.' },
            { name: 'node-fetch', message: 'External systems must be called through an adapter in src/integrations/.' },
            { name: 'stripe', message: 'Use an adapter in src/integrations/.' },
            { name: 'ioredis', message: 'Use RedisService from src/core/.' },
          ],
          patterns: [
            { group: ['@aws-sdk/*', 'openai', '@anthropic-ai/*'], message: 'Third-party SDKs may only be used in src/integrations/.' },
            { group: ['../*', '../../*'], message: 'Use a path alias (@/...).' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'External systems must be called through an adapter in src/integrations/.' },
      ],
      // ---- D1: no database queries outside TransactionManager ----
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='db']",
          message:
            'Do not call `db` directly inside modules — use TransactionManager so the RLS context is set. See docs/rules/02-backend-nestjs.md section D1.',
        },
        {
          // 07-security.md C2: no string concatenation into SQL
          selector: "CallExpression[callee.property.name='execute'] > TemplateLiteral[expressions.length>0]",
          message:
            'No interpolation into SQL. Use Drizzle\'s `sql` tagged template to parameterise. See docs/rules/07-security.md section C2.',
        },
      ],
    },
  },
  {
    // ---- B1: thin controllers ----
    files: ['src/**/*.controller.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    // Nest decorators need metadata; relax some rules for module/entity files
    files: ['src/**/*.module.ts', 'src/**/schema/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);

export default nest;
