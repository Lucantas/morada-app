import type { ActivityRepository } from '../domain/activity-repository';

export interface ContractUser {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
}

export function runActivityRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<ActivityRepository>,
  addUser: (user: ContractUser) => Promise<void>,
): void {
  describe(label, () => {
    test('records and lists newest first', async () => {
      const repo = await makeRepo('condo-a');
      await addUser({ id: 'u-1', name: 'Ana', email: null, username: 'ana' });
      await repo.record({
        actorUserId: 'u-1',
        action: 'account.created',
        subjectId: 'acc-1',
        at: new Date('2026-05-01T10:00:00Z'),
      });
      await repo.record({
        actorUserId: 'u-1',
        action: 'receipt.monthly',
        subjectId: null,
        at: new Date('2026-05-02T10:00:00Z'),
      });

      const entries = await repo.latest(10);

      expect(entries.map((e) => [e.action, e.actorName, e.subjectId])).toEqual([
        ['receipt.monthly', 'Ana', null],
        ['account.created', 'Ana', 'acc-1'],
      ]);
      expect(entries[0]?.at).toEqual(new Date('2026-05-02T10:00:00Z'));
    });

    test('latest honours the limit', async () => {
      const repo = await makeRepo('condo-a');
      await addUser({ id: 'u-1', name: 'Ana', email: null, username: 'ana' });
      for (const day of [1, 2, 3]) {
        await repo.record({
          actorUserId: 'u-1',
          action: 'income.created',
          subjectId: null,
          at: new Date(`2026-05-0${day}T10:00:00Z`),
        });
      }

      expect(await repo.latest(2)).toHaveLength(2);
    });

    test('actor name falls back to e-mail, then username', async () => {
      const repo = await makeRepo('condo-a');
      await addUser({ id: 'u-1', name: null, email: 'ana@x.com', username: 'ana' });
      await addUser({ id: 'u-2', name: null, email: null, username: 'beto' });
      await repo.record({
        actorUserId: 'u-1',
        action: 'account.created',
        subjectId: null,
        at: new Date('2026-05-01T10:00:00Z'),
      });
      await repo.record({
        actorUserId: 'u-2',
        action: 'account.updated',
        subjectId: null,
        at: new Date('2026-05-02T10:00:00Z'),
      });

      const entries = await repo.latest(10);

      expect(entries.map((e) => e.actorName)).toEqual(['beto', 'ana@x.com']);
    });

    test('latest is condo-scoped', async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      await addUser({ id: 'u-1', name: 'Ana', email: null, username: 'ana' });
      await repoB.record({
        actorUserId: 'u-1',
        action: 'account.created',
        subjectId: null,
        at: new Date('2026-05-01T10:00:00Z'),
      });

      expect(await repoA.latest(10)).toEqual([]);
      expect(await repoB.latest(10)).toHaveLength(1);
    });
  });
}
