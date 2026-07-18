import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSpecTrailer, isFeaturePath } from './check-spec-trailer.mjs';

const specExistsTrue = () => true;
const specExistsFalse = () => false;

test('isFeaturePath matches api and web feature dirs, excludes infra', () => {
  assert.equal(isFeaturePath('apps/api/src/receipts/app/pay-receipt.ts'), true);
  assert.equal(isFeaturePath('apps/web/src/features/residents/ui/x.tsx'), true);
  assert.equal(isFeaturePath('apps/api/src/shared/domain/iso-date.ts'), false);
  assert.equal(isFeaturePath('apps/api/src/platform/auth.ts'), false);
  assert.equal(isFeaturePath('apps/api/src/compose.ts'), false);
  assert.equal(isFeaturePath('apps/web/src/app/router.tsx'), false);
  assert.equal(isFeaturePath('docs/x.md'), false);
});

test('no feature paths → ok without trailer', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['docs/x.md', 'apps/api/src/platform/auth.ts'],
    message: 'chore: tidy',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('feature path without trailer → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay',
    specExists: specExistsTrue,
  });
  assert.equal(r.ok, false);
});

test('feature path with existing spec path → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay\n\nSpec: docs/superpowers/specs/x-design.md',
    specExists: specExistsTrue,
  });
  assert.equal(r.ok, true);
});

test('feature path with non-existent spec path → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'feat: pay\n\nSpec: docs/superpowers/specs/missing.md',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, false);
});

test('feature path with "none — reason" escape hatch → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: typo\n\nSpec: none — one-line copy fix',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('"none" with empty reason → fail', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: x\n\nSpec: none',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, false);
});
