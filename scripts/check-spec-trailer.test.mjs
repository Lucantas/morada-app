import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSpecTrailer, evaluateRange, isFeaturePath } from './check-spec-trailer.mjs';

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

test('"None — reason" escape hatch is case-insensitive → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: typo\n\nSpec: None — one-line copy fix',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('"NONE — reason" escape hatch is case-insensitive → ok', () => {
  const r = evaluateSpecTrailer({
    touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    message: 'fix: typo\n\nSpec: NONE — one-line copy fix',
    specExists: specExistsFalse,
  });
  assert.equal(r.ok, true);
});

test('evaluateRange: every feature-touching commit has a valid trailer → ok', () => {
  const commits = [
    {
      sha: 'aaa1111',
      message: 'chore: tidy',
      touchedPaths: ['docs/x.md'],
    },
    {
      sha: 'bbb2222',
      message: 'feat: pay\n\nSpec: docs/superpowers/specs/x-design.md',
      touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    },
    {
      sha: 'ccc3333',
      message: 'fix: typo\n\nSpec: none — one-line copy fix',
      touchedPaths: ['apps/web/src/features/residents/ui/x.tsx'],
    },
  ];
  const r = evaluateRange(commits, specExistsTrue);
  assert.equal(r.ok, true);
});

test('evaluateRange: one feature-touching commit lacks a trailer even though another commit has one → fail, names offending commit', () => {
  const commits = [
    {
      sha: 'aaa1111',
      message: 'feat: notices\n\nSpec: docs/superpowers/specs/x-design.md',
      touchedPaths: ['apps/api/src/notices/app/send-notice.ts'],
    },
    {
      sha: 'bbb2222',
      message: 'feat: pay receipt without trailer',
      touchedPaths: ['apps/api/src/receipts/app/pay-receipt.ts'],
    },
  ];
  const r = evaluateRange(commits, specExistsTrue);
  assert.equal(r.ok, false);
  assert.match(r.reason, /bbb2222/);
});
