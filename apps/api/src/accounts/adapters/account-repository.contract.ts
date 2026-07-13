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
        dateLabel: '2026-07-10',
        valueCents: 5000,
        status: 'pendente' as const,
      };

      await repo.save(account);

      expect(await repo.getById('a-1')).toEqual(account);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'a-1',
        description: 'Energia',
        category: 'Utilidades',
        dateLabel: '2026-07-10',
        valueCents: 5000,
        status: 'pendente',
      });
      await repo.save({
        id: 'a-1',
        description: 'Energia Elétrica',
        category: 'Utilidades',
        dateLabel: '2026-07-11',
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
  });
}
