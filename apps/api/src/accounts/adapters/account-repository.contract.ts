import { AccountNotFoundError } from '../domain/errors';
import type { AccountRepository } from '../domain/account-repository';

export function runAccountRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<AccountRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips', async () => {
      const repo = await makeRepo('condo-a');
      const account = {
        id: 'a-1',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 5000,
        status: 'pendente' as const,
      };

      await repo.save(account);

      expect(await repo.getById('a-1')).toEqual({ ...account, dueDate: null, hasProof: false });
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo('condo-a');
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
      const repo = await makeRepo('condo-a');
      expect(await repo.getById('nope')).toBeNull();
    });

    test('archive hides an account from every read', async () => {
      const repo = await makeRepo('condo-a');
      const base = { description: 'Energia', category: 'Utilidades', date: '2026-04-05' };
      await repo.save({ ...base, id: 'a', valueCents: 5000, status: 'pendente' });
      await repo.save({ ...base, id: 'b', valueCents: 6000, status: 'pendente' });

      await repo.archive('a');

      expect(await repo.getById('a')).toBeNull();
      expect((await repo.list()).map((a) => a.id)).toEqual(['b']);
    });

    test('due date round-trips and defaults to null', async () => {
      const repo = await makeRepo('condo-a');
      const base = {
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 5000,
        status: 'pendente' as const,
      };

      await repo.save({ ...base, id: 'with-due', dueDate: '2026-04-20' });
      await repo.save({ ...base, id: 'no-due' });

      expect((await repo.getById('with-due'))?.dueDate).toBe('2026-04-20');
      expect((await repo.getById('no-due'))?.dueDate).toBeNull();
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const account = {
        id: 'iso-1',
        description: 'Energia',
        category: 'Utilidades',
        date: '2026-04-05',
        valueCents: 5000,
        status: 'pendente' as const,
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      };
      await repoA.save(account);

      expect(await repoB.list()).toEqual([]);
      expect(await repoB.getById('iso-1')).toBeNull();
      expect(await repoB.getProof('iso-1')).toBeNull();
      await expect(repoB.save({ ...account, status: 'pago' })).rejects.toThrow(
        AccountNotFoundError,
      );
      await repoB.archive('iso-1');

      expect((await repoA.getById('iso-1'))?.status).toBe('pendente');
      expect(await repoA.getProof('iso-1')).not.toBeNull();
    });
  });
}
