// CommonJS (.cjs) because apps/web is "type":"module". The tseslint spread
// REGISTERS the @typescript-eslint rules; the boundaries block is the
// architecture enforcer (default 'disallow' => allowed-import graph is a whitelist).
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  prettierConfig,
  {
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'], location: 'anywhere' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'feature-domain', pattern: 'src/features/*/domain/**', capture: ['feature'] },
        { type: 'feature-data', pattern: 'src/features/*/data/**', capture: ['feature'] },
        { type: 'feature-ui', pattern: 'src/features/*/ui/**', capture: ['feature'] },
        { type: 'shared-ui', pattern: 'src/shared/ui/**' },
        { type: 'shared-lib', pattern: 'src/shared/lib/**' },
        { type: 'shared-config', pattern: 'src/shared/config/**' },
        { type: 'test-helpers', pattern: 'src/test/**' },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: ['app'],
              allow: [
                'feature-ui',
                'feature-data',
                'feature-domain',
                'shared-ui',
                'shared-lib',
                'shared-config',
              ],
            },
            {
              from: ['feature-domain'],
              allow: ['feature-domain', 'shared-lib'],
            },
            {
              from: ['feature-data'],
              allow: [
                'feature-domain',
                ['feature-data', { feature: '${from.feature}' }],
                'shared-lib',
              ],
            },
            {
              from: ['feature-ui'],
              allow: [
                'feature-domain',
                ['feature-ui', { feature: '${from.feature}' }],
                'shared-ui',
                'shared-lib',
                'shared-config',
              ],
            },
            { from: ['shared-ui'], allow: ['shared-ui', 'shared-lib'] },
            { from: ['shared-lib'], allow: ['shared-lib'] },
            { from: ['shared-config'], allow: ['shared-config', 'shared-lib'] },
            {
              from: ['test-helpers'],
              allow: [
                'feature-domain',
                'feature-data',
                'feature-ui',
                'shared-ui',
                'shared-lib',
                'shared-config',
                'test-helpers',
              ],
            },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['feature-domain'],
              disallow: ['react', 'react-dom', '@tanstack/*', 'zustand'],
              message: 'domain must stay pure — only zod is allowed',
            },
            {
              from: ['feature-data'],
              disallow: ['react', 'react-dom', '@tanstack/*', 'zustand'],
              message: 'data must not depend on React/query/store libraries',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { 'boundaries/element-types': 'off', 'boundaries/external': 'off' },
  },
);
