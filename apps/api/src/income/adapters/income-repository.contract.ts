import type { IncomeRepository } from '../domain/income-repository';

// Behavioural contract every IncomeRepository must satisfy, run against every
// adapter so implementations stay in lockstep.
export function runIncomeRepositoryContract(
  label: string,
  makeRepo: () => Promise<IncomeRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips (including date and proofDataUrl)', async () => {
      const repo = await makeRepo();
      const income = {
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: 'data:image/png;base64,aGVsbG8=',
      };

      await repo.save(income);

      expect(await repo.getById('i-1')).toEqual(income);
    });

    test('list returns saved incomes', async () => {
      const repo = await makeRepo();
      const income = {
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: undefined,
      };

      await repo.save(income);

      expect(await repo.list()).toEqual([income]);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: undefined,
      });
      await repo.save({
        id: 'i-1',
        description: 'Aluguel salão de festas (atualizado)',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 18000,
        proofDataUrl: undefined,
      });

      expect(await repo.list()).toHaveLength(1);
      expect((await repo.getById('i-1'))?.description).toBe('Aluguel salão de festas (atualizado)');
      expect((await repo.getById('i-1'))?.valueCents).toBe(18000);
    });

    test('archive hides the income from list and getById', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: undefined,
      });

      await repo.archive('i-1');

      expect(await repo.getById('i-1')).toBeNull();
      expect(await repo.list()).toEqual([]);
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.getById('nope')).toBeNull();
    });
  });
}
