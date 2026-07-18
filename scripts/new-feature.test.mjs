import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, planFiles, validate } from './new-feature.mjs';

test('render substitutes both placeholders', () => {
  const out = render('export const __feature__ = "__Feature__";', 'water-bill');
  assert.equal(out, 'export const water-bill = "WaterBill";');
});

test('planFiles maps api templates to feature dir', () => {
  const files = planFiles({ app: 'api', name: 'water' });
  assert.ok(files.some((f) => f.to === 'apps/api/src/water/domain/water.ts'));
  assert.ok(files.some((f) => f.to === 'apps/api/src/water/adapters/http/routes.ts'));
});

test('validate rejects missing spec', () => {
  assert.throws(() =>
    validate({ app: 'api', name: 'water', spec: undefined, specExists: () => false }),
  );
});

test('validate rejects non-existent spec file', () => {
  assert.throws(() =>
    validate({ app: 'api', name: 'water', spec: 'docs/x.md', specExists: () => false }),
  );
});

test('validate rejects existing feature dir', () => {
  assert.throws(() =>
    validate({
      app: 'api',
      name: 'residents',
      spec: 'docs/x.md',
      specExists: () => true,
      dirExists: () => true,
    }),
  );
});

test('validate accepts good input', () => {
  assert.doesNotThrow(() =>
    validate({
      app: 'api',
      name: 'water',
      spec: 'docs/x.md',
      specExists: () => true,
      dirExists: () => false,
    }),
  );
});
