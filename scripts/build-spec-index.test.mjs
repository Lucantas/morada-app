import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, featureOf } from './build-spec-index.mjs';

test('featureOf extracts feature name from api and web paths', () => {
  assert.equal(featureOf('apps/api/src/receipts/app/x.ts'), 'api/receipts');
  assert.equal(featureOf('apps/web/src/features/residents/ui/x.tsx'), 'web/residents');
  assert.equal(featureOf('apps/api/src/platform/auth.ts'), null);
});

test('buildIndex groups specs by feature', () => {
  const md = buildIndex([
    {
      subject: 'feat: pay',
      spec: 'docs/superpowers/specs/a.md',
      files: ['apps/api/src/receipts/app/x.ts'],
    },
    {
      subject: 'feat: list',
      spec: 'docs/superpowers/specs/b.md',
      files: ['apps/api/src/receipts/adapters/http/routes.ts'],
    },
  ]);
  assert.match(md, /api\/receipts/);
  assert.match(md, /a\.md/);
  assert.match(md, /b\.md/);
});
