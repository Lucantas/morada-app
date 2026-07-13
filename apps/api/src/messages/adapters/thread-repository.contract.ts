import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

const build = (over: Partial<Thread>): Thread => ({
  id: 't-1',
  residentName: 'Ana',
  apt: 'Apto 1',
  unread: false,
  messages: [],
  ...over,
});

// Behavioural contract every ThreadRepository must satisfy, run against both the
// SQLite and Postgres adapters so the two stores stay in lockstep.
export function runThreadRepositoryContract(
  label: string,
  makeRepo: () => Promise<ThreadRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips including messages and unread', async () => {
      const repo = await makeRepo();
      const thread = build({
        id: 't-1',
        unread: true,
        messages: [{ id: 'm-1', author: 'resident', text: 'Oi', dateLabel: 'Agora' }],
      });

      await repo.save(thread);

      expect(await repo.getById('t-1')).toEqual(thread);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save(build({ id: 't-1', residentName: 'Ana', unread: false }));
      await repo.save(build({ id: 't-1', residentName: 'Ana Paula', unread: true }));

      expect(await repo.list()).toHaveLength(1);
      expect((await repo.getById('t-1'))?.residentName).toBe('Ana Paula');
      expect((await repo.getById('t-1'))?.unread).toBe(true);
    });

    test('persists appended messages', async () => {
      const repo = await makeRepo();
      await repo.save(build({ id: 't-1', messages: [] }));

      const stored = await repo.getById('t-1');
      if (!stored) throw new Error('thread should exist');
      await repo.save({
        ...stored,
        messages: [
          ...stored.messages,
          { id: 'm-1', author: 'admin', text: 'Olá', dateLabel: 'Agora' },
        ],
      });

      expect((await repo.getById('t-1'))?.messages).toHaveLength(1);
      expect((await repo.getById('t-1'))?.messages[0]?.text).toBe('Olá');
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.getById('nope')).toBeNull();
    });
  });
}
