import { buildMessage, buildThread } from '@/test/factories.messages';

import { InMemoryThreadRepository } from '../data/in-memory-thread-repository';

import { EmptyMessageError, ThreadNotFoundError } from './errors';
import { postMessage } from './post-message';

describe('postMessage', () => {
  test('appends the message with an id and "Agora" label', async () => {
    const repo = new InMemoryThreadRepository([
      buildThread({ id: 't-1', messages: [buildMessage({ id: 'm-1', text: 'Oi' })] }),
    ]);

    const updated = await postMessage(repo, 't-1', 'admin', 'Olá de volta');

    expect(updated.messages).toHaveLength(2);
    const appended = updated.messages[1];
    expect(appended?.text).toBe('Olá de volta');
    expect(appended?.author).toBe('admin');
    expect(appended?.dateLabel).toBe('Agora');
    expect(appended?.id).toBeTruthy();
    expect(await repo.getById('t-1')).toEqual(updated);
  });

  test('does not mutate the original thread or its messages (immutability)', async () => {
    const original = buildThread({
      id: 't-2',
      unread: false,
      messages: [buildMessage({ id: 'm-1' })],
    });
    const repo = new InMemoryThreadRepository([original]);

    await postMessage(repo, 't-2', 'resident', 'Nova mensagem');

    expect(original.messages).toHaveLength(1);
    expect(original.unread).toBe(false);
  });

  test('sets unread to true when the author is the resident', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 't-3', unread: false })]);

    const updated = await postMessage(repo, 't-3', 'resident', 'Preciso de ajuda');

    expect(updated.unread).toBe(true);
  });

  test('sets unread to false when the author is the admin', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 't-4', unread: true })]);

    const updated = await postMessage(repo, 't-4', 'admin', 'Já resolvemos');

    expect(updated.unread).toBe(false);
  });

  test('rejects empty text', async () => {
    const repo = new InMemoryThreadRepository([buildThread({ id: 't-5' })]);

    await expect(postMessage(repo, 't-5', 'admin', '   ')).rejects.toBeInstanceOf(
      EmptyMessageError,
    );
  });

  test('throws when the thread is missing', async () => {
    const repo = new InMemoryThreadRepository([]);

    await expect(postMessage(repo, 'nope', 'admin', 'Olá')).rejects.toBeInstanceOf(
      ThreadNotFoundError,
    );
  });
});
