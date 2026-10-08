import boundaries from 'eslint-plugin-boundaries';
import a11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { base } from './base.js';

/**
 * Icon sets other than lucide-react. Two icon sets in one product means two
 * stroke weights and two grids; see docs/rules/11-ui-design-system.md section C1.
 */
const ICON_PACKAGES = [
  'react-icons',
  '@heroicons/react',
  '@tabler/icons-react',
  '@radix-ui/react-icons',
  'react-feather',
  'phosphor-react',
  '@phosphor-icons/react',
];

const ICON_PACKAGE_PATTERNS = ['react-icons/*', '@heroicons/react/*', '@tabler/icons-react/*'];

const ICON_MESSAGE =
  'lucide-react is the only icon set. See docs/rules/11-ui-design-system.md section C1.';
const ALIAS_MESSAGE = 'Use a path alias (@/...).';

/**
 * `no-restricted-imports` is one rule, so a later flat-config block replaces the
 * whole option object rather than adding to it. Every block therefore builds its
 * list from here instead of listing paths again and silently dropping one.
 */
function restrictedImports({ extraPatterns = [] } = {}) {
  return [
    'error',
    {
      paths: [
        { name: 'axios', message: 'Use the client in @/lib/http.' },
        ...ICON_PACKAGES.map((name) => ({ name, message: ICON_MESSAGE })),
      ],
      patterns: [
        { group: ['../*', '../../*'], message: ALIAS_MESSAGE },
        { group: ICON_PACKAGE_PATTERNS, message: ICON_MESSAGE },
        ...extraPatterns,
      ],
    },
  ];
}

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
      'no-restricted-imports': restrictedImports(),
    },
  },
  {
    // ---- A4: shared/ui must stay free of domain logic ----
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': restrictedImports({
        extraPatterns: [
          {
            group: ['@/features/*', '@/entities/*'],
            message:
              'shared/ must not know about the domain. See docs/rules/04-frontend-react.md section A4.',
          },
        ],
      }),
    },
  },
  {
    // Primitives are hand-written like everything else, so they keep the shared
    // size rules; only the component return-type annotation is waived, as above.
    files: ['src/shared/ui/**'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'off' },
  },
  {
    // ---- 11 section C1: one icon set, in the layers the blocks above miss ----
    files: ['src/app/**', 'src/lib/**', 'src/config/**'],
    rules: { 'no-restricted-imports': restrictedImports() },
  },
  {
    // ---- 11 section E6: raw controls only inside shared/ui ----
    files: ['src/app/**', 'src/entities/**', 'src/features/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="button"]',
          message:
            'Use Button, IconButton or LinkButton from @/shared/ui: a raw <button> loses the focus ring, the disabled treatment and the height scale. See docs/rules/11-ui-design-system.md section E6.',
        },
        {
          selector: 'JSXOpeningElement[name.name=/^(input|select|textarea)$/]',
          message:
            'Use Input, Select, Textarea or CheckboxField from @/shared/ui. See docs/rules/11-ui-design-system.md section E6.',
        },
      ],
    },
  },
);

export default reactConfig;
