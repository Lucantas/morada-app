import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, featureOf, parseGitLog } from './build-spec-index.mjs';

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

test('parseGitLog captures each commit files within its own record', () => {
  const raw =
    '\x01feat(api): add receipt endpoint\x00Spec: docs/superpowers/specs/x.md\x00\n' +
    'apps/api/src/receipts/app/x.ts\n' +
    'apps/api/src/receipts/adapters/http/routes.ts\n' +
    '\x01chore: tidy up readme\x00\x00\n' +
    'README.md\n' +
    'docs/notes.md\n' +
    'scripts/tidy.mjs\n';

  const commits = parseGitLog(raw);

  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    subject: 'feat(api): add receipt endpoint',
    spec: 'docs/superpowers/specs/x.md',
    files: ['apps/api/src/receipts/app/x.ts', 'apps/api/src/receipts/adapters/http/routes.ts'],
  });
  assert.deepEqual(commits[1], {
    subject: 'chore: tidy up readme',
    spec: null,
    files: ['docs/notes.md', 'scripts/tidy.mjs'],
  });
});
