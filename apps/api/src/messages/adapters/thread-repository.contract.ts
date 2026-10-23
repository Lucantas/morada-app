import { ThreadNotFoundError } from '../domain/errors';
import type { Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

const build = (over: Partial<Thread>): Thread => ({
  id: 't-1',
  residentName: 'Ana',
  apt: 'Apto 1',
  residentId: null,
  apartmentId: null,
  unread: false,
  messages: [],
  ...over,
});

export function runThreadRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<ThreadRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips including messages and unread', async () => {
      const repo = await makeRepo('condo-a');
      const thread = build({
        id: 't-1',
        unread: true,
        messages: [{ id: 'm-1', author: 'resident', text: 'Oi', dateLabel: 'Agora' }],
      });

      await repo.save(thread);

      expect(await repo.getById('t-1')).toEqual(thread);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(build({ id: 't-1', residentName: 'Ana', unread: false }));
      await repo.save(build({ id: 't-1', residentName: 'Ana Paula', unread: true }));

      expect(await repo.list()).toHaveLength(1);
      expect((await repo.getById('t-1'))?.residentName).toBe('Ana Paula');
      expect((await repo.getById('t-1'))?.unread).toBe(true);
    });

    test('persists appended messages', async () => {
      const repo = await makeRepo('condo-a');
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
      const repo = await makeRepo('condo-a');
      expect(await repo.getById('nope')).toBeNull();
    });

    test('thread keeps its resident and apartment links', async () => {
      const repo = await makeRepo('condo-a');
      const thread = build({ id: 't-1', residentId: 'r-1', apartmentId: 'ap-1' });

      await repo.save(thread);

      expect(await repo.getById('t-1')).toEqual(thread);
      expect((await repo.list())[0]).toMatchObject({ residentId: 'r-1', apartmentId: 'ap-1' });
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const thread = build({ id: 'iso-1', residentName: 'Ana' });
      await repoA.save(thread);

      expect(await repoB.list()).toEqual([]);
      expect(await repoB.getById('iso-1')).toBeNull();
      await expect(repoB.save({ ...thread, residentName: 'Hack' })).rejects.toBeInstanceOf(
        ThreadNotFoundError,
      );

      expect((await repoA.getById('iso-1'))?.residentName).toBe('Ana');
    });
  });
}
