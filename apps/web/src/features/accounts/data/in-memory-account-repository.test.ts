import { buildAccount } from '@/test/factories.accounts';

import { InMemoryAccountRepository } from './in-memory-account-repository';

describe('InMemoryAccountRepository', () => {
  test('lists seeded accounts', async () => {
    const repo = new InMemoryAccountRepository([
      buildAccount({ id: 'a' }),
      buildAccount({ id: 'b' }),
    ]);

    expect((await repo.list()).map((a) => a.id).sort()).toEqual(['a', 'b']);
  });

  test('save upserts and getById returns it', async () => {
    const repo = new InMemoryAccountRepository([]);
    const account = buildAccount({ id: 'x', description: 'Nova' });

    await repo.save(account);

    expect(await repo.getById('x')).toEqual({ ...account, hasProof: false });
  });

  test('save does not mutate the previously returned list (immutability)', async () => {
    const repo = new InMemoryAccountRepository([buildAccount({ id: 'a' })]);
    const before = await repo.list();

    await repo.save(buildAccount({ id: 'b' }));

    expect(before).toHaveLength(1);
  });

  test('rejects malformed seed data at the boundary', () => {
    expect(() => new InMemoryAccountRepository([{ id: 'a', description: 'X' }])).toThrow();
  });

  test('archive removes the account from every read', async () => {
    const repo = new InMemoryAccountRepository([buildAccount({ id: 'a' })]);

    await repo.archive('a');

    expect(await repo.getById('a')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });
});

describe('InMemoryAccountRepository — proof', () => {
  test('save with a proofDataUrl reports hasProof and drops the raw data URL', async () => {
    const repo = new InMemoryAccountRepository([]);

    const saved = await repo.save(
      buildAccount({ id: 'p', proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }),
    );

    expect(saved.hasProof).toBe(true);
    expect(saved.proofDataUrl).toBeUndefined();
    expect((await repo.getById('p'))?.hasProof).toBe(true);
  });

  test('save with proofDataUrl null clears hasProof', async () => {
    const repo = new InMemoryAccountRepository([]);
    await repo.save(buildAccount({ id: 'p', proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));

    const cleared = await repo.save(buildAccount({ id: 'p', proofDataUrl: null }));

    expect(cleared.hasProof).toBe(false);
  });
});
