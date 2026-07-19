import type { NoticeRepository } from '../domain/notice-repository';

// Behavioural contract every NoticeRepository must satisfy.
export function runNoticeRepositoryContract(
  label: string,
  makeRepo: () => Promise<NoticeRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips, always dismissed false', async () => {
      const repo = await makeRepo();
      const notice = {
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo do aviso',
        kind: 'aviso' as const,
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      };

      await repo.save(notice);

      expect(await repo.getById('n-1')).toEqual(notice);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo',
        kind: 'aviso',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });
      await repo.save({
        id: 'n-1',
        title: 'Aviso atualizado',
        body: 'Corpo',
        kind: 'urgente',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });

      expect(await repo.list(null)).toHaveLength(1);
      expect((await repo.getById('n-1'))?.title).toBe('Aviso atualizado');
    });

    test('remove deletes the notice', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo',
        kind: 'aviso',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });

      await repo.remove('n-1');

      expect(await repo.getById('n-1')).toBeNull();
      expect(await repo.list(null)).toHaveLength(0);
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.getById('nope')).toBeNull();
    });

    test('dismiss marks the notice dismissed only for the dismissing resident', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo',
        kind: 'aviso',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });

      const dismissed = await repo.dismiss('n-1', 'resident-a');

      expect(dismissed.dismissed).toBe(true);
      expect((await repo.list('resident-a')).find((n) => n.id === 'n-1')?.dismissed).toBe(true);
      expect((await repo.list('resident-b')).find((n) => n.id === 'n-1')?.dismissed).toBe(false);
      expect((await repo.list(null)).find((n) => n.id === 'n-1')?.dismissed).toBe(false);
    });

    test('dismiss is idempotent for the same resident', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo',
        kind: 'aviso',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });

      await repo.dismiss('n-1', 'resident-a');
      const secondDismiss = await repo.dismiss('n-1', 'resident-a');

      expect(secondDismiss.dismissed).toBe(true);
      expect((await repo.list('resident-a')).find((n) => n.id === 'n-1')?.dismissed).toBe(true);
    });

    test('remove also clears dismissals for that notice', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'n-1',
        title: 'Aviso',
        body: 'Corpo',
        kind: 'aviso',
        audience: 'todos',
        dateLabel: 'Agora',
        dismissed: false,
      });
      await repo.dismiss('n-1', 'resident-a');

      await repo.remove('n-1');

      expect(await repo.getById('n-1')).toBeNull();
    });
  });
}
