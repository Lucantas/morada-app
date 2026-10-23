import { IncomeNotFoundError } from '../domain/errors';
import type { IncomeRepository } from '../domain/income-repository';

export function runIncomeRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<IncomeRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips (including date), exposing hasProof (not the raw proof)', async () => {
      const repo = await makeRepo('condo-a');
      const income = {
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: 'data:image/png;base64,aGVsbG8=',
      };

      await repo.save(income);

      const { proofDataUrl, ...withoutProof } = income;
      void proofDataUrl;
      expect(await repo.getById('i-1')).toEqual({ ...withoutProof, hasProof: true });
    });

    test('list returns saved incomes', async () => {
      const repo = await makeRepo('condo-a');
      const income = {
        id: 'i-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: undefined,
      };

      await repo.save(income);

      expect(await repo.list()).toEqual([{ ...income, proofDataUrl: undefined, hasProof: false }]);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo('condo-a');
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
      const repo = await makeRepo('condo-a');
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
      const repo = await makeRepo('condo-a');
      expect(await repo.getById('nope')).toBeNull();
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const income = {
        id: 'iso-1',
        description: 'Aluguel salão de festas',
        source: 'Apto 302',
        date: '2026-04-05',
        valueCents: 15000,
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      };
      await repoA.save(income);

      expect(await repoB.list()).toEqual([]);
      expect(await repoB.getById('iso-1')).toBeNull();
      expect(await repoB.getProof('iso-1')).toBeNull();
      await expect(repoB.save({ ...income, valueCents: 1 })).rejects.toThrow(IncomeNotFoundError);
      await repoB.archive('iso-1');

      expect((await repoA.getById('iso-1'))?.valueCents).toBe(15000);
      expect(await repoA.getProof('iso-1')).not.toBeNull();
    });
  });
}
