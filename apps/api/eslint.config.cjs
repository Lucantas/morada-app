// Hexagonal boundaries (lint-enforced): domain is pure, app must not import
// adapters, adapters/platform wire the infra. Mirrors the web app's approach.
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'data/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  prettierConfig,
  {
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/*/domain/**', capture: ['context'] },
        { type: 'app', pattern: 'src/*/app/**', capture: ['context'] },
        { type: 'adapters', pattern: 'src/*/adapters/**', capture: ['context'] },
        { type: 'platform', pattern: 'src/platform/**' },
        { type: 'main', pattern: 'src/*.ts' },
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
            { from: ['domain'], allow: ['domain'] },
            { from: ['app'], allow: ['domain', 'app', 'platform'] },
            { from: ['adapters'], allow: ['domain', 'app', 'adapters', 'platform'] },
            { from: ['platform'], allow: ['platform'] },
            { from: ['main'], allow: ['domain', 'app', 'adapters', 'platform', 'main'] },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['domain'],
              disallow: ['hono', 'hono/*', '@hono/*', 'better-sqlite3'],
              message: 'domain must stay pure — no framework or driver imports',
            },
            {
              from: ['app'],
              disallow: ['hono', 'hono/*', '@hono/*', 'better-sqlite3'],
              message: 'app orchestrates domain via ports — no framework or driver imports',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/testing/**'],
    rules: { 'boundaries/element-types': 'off', 'boundaries/external': 'off' },
  },
);
