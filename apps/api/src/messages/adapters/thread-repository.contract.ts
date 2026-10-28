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
  viewers: { a: string; b: string },
): void {
  describe(label, () => {
    const { a, b } = viewers;
    test('save then getById round-trips including messages', async () => {
      const repo = await makeRepo('condo-a');
      const thread = build({
        id: 't-1',
        messages: [{ id: 'm-1', author: 'resident', text: 'Oi', dateLabel: 'Agora' }],
      });

      await repo.save(thread);

      expect(await repo.getById('t-1', a)).toEqual(thread);
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(build({ id: 't-1', residentName: 'Ana' }));
      await repo.save(build({ id: 't-1', residentName: 'Ana Paula' }));

      expect(await repo.list(a)).toHaveLength(1);
      expect((await repo.getById('t-1', a))?.residentName).toBe('Ana Paula');
    });

    test('persists appended messages', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(build({ id: 't-1', messages: [] }));

      const stored = await repo.getById('t-1', a);
      if (!stored) throw new Error('thread should exist');
      await repo.save({
        ...stored,
        messages: [
          ...stored.messages,
          { id: 'm-1', author: 'admin', text: 'Olá', dateLabel: 'Agora' },
        ],
      });

      expect((await repo.getById('t-1', a))?.messages).toHaveLength(1);
      expect((await repo.getById('t-1', a))?.messages[0]?.text).toBe('Olá');
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo('condo-a');
      expect(await repo.getById('nope', a)).toBeNull();
    });

    test('thread keeps its resident and apartment links', async () => {
      const repo = await makeRepo('condo-a');
      const thread = build({ id: 't-1', residentId: 'r-1', apartmentId: 'ap-1' });

      await repo.save(thread);

      expect(await repo.getById('t-1', a)).toEqual(thread);
      expect((await repo.list(a))[0]).toMatchObject({ residentId: 'r-1', apartmentId: 'ap-1' });
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const thread = build({ id: 'iso-1', residentName: 'Ana' });
      await repoA.save(thread);

      expect(await repoB.list(b)).toEqual([]);
      expect(await repoB.getById('iso-1', b)).toBeNull();
      await expect(repoB.save({ ...thread, residentName: 'Hack' })).rejects.toBeInstanceOf(
        ThreadNotFoundError,
      );

      expect((await repoA.getById('iso-1', a))?.residentName).toBe('Ana');
    });

    const resident = (id: string): Thread =>
      build({
        id,
        messages: [{ id: 'm-1', author: 'resident', text: 'Oi', dateLabel: 'Agora' }],
      });

    test('a thread with no resident message is read for everyone', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(build({ id: 't-1' }));

      expect((await repo.getById('t-1', a))?.unread).toBe(false);
      expect((await repo.getById('t-1', b))?.unread).toBe(false);
    });

    test('a resident message makes the thread unread for every viewer', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(resident('t-1'));
      await repo.recordResidentMessage('t-1');

      expect((await repo.getById('t-1', a))?.unread).toBe(true);
      expect((await repo.list(b))[0]?.unread).toBe(true);
    });

    test('unread is per viewer: staff A reading does not clear it for staff B', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(resident('t-1'));
      await repo.recordResidentMessage('t-1');

      await repo.markRead('t-1', a);

      expect((await repo.getById('t-1', a))?.unread).toBe(false);
      expect((await repo.getById('t-1', b))?.unread).toBe(true);
    });

    test('a resident message after a read makes the thread unread again for that reader', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(resident('t-1'));
      await repo.recordResidentMessage('t-1');
      await repo.markRead('t-1', a);

      await repo.recordResidentMessage('t-1');

      expect((await repo.getById('t-1', a))?.unread).toBe(true);
    });

    test('markRead in condo A never touches a thread of condo B', async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      await repoA.save(resident('iso-1'));
      await repoA.recordResidentMessage('iso-1');

      await repoB.markRead('iso-1', b);

      expect((await repoA.getById('iso-1', b))?.unread).toBe(true);
    });
  });
}
