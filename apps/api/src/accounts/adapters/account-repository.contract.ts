import type { AccountRepository } from '../domain/account-repository';

// Behavioural contract every AccountRepository must satisfy, run against both the
// SQLite and Postgres adapters so the two stores stay in lockstep.
export function runAccountRepositoryContract(
  label: string,
  makeRepo: () => Promise<AccountRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips', async () => {
      const repo = await makeRepo();
      const account = {
        id: 'a-1',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 5000,
        status: 'pendente' as const,
      };

      await repo.save(account);

      expect(await repo.getById('a-1')).toEqual({ ...account, hasProof: false });
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'a-1',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 5000,
        status: 'pendente',
      });
      await repo.save({
        id: 'a-1',
        description: 'Energia Elétrica',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 6000,
        status: 'pago',
      });

      expect(await repo.list()).toHaveLength(1);
      expect((await repo.getById('a-1'))?.description).toBe('Energia Elétrica');
      expect((await repo.getById('a-1'))?.valueCents).toBe(6000);
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.getById('nope')).toBeNull();
    });

    test('archive hides an account from every read', async () => {
      const repo = await makeRepo();
      const base = { description: 'Energia', category: 'Utilidades', date: '2026-04-05' };
      await repo.save({ ...base, id: 'a', valueCents: 5000, status: 'pendente' });
      await repo.save({ ...base, id: 'b', valueCents: 6000, status: 'pendente' });

      await repo.archive('a');

      expect(await repo.getById('a')).toBeNull();
      expect((await repo.list()).map((a) => a.id)).toEqual(['b']);
    });
  });
}
