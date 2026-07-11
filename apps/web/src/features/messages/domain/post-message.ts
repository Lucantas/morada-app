import { EmptyMessageError, ThreadNotFoundError } from './errors';
import type { MessageAuthor, Thread } from './message';
import { messageDraftSchema } from './message';
import type { ThreadRepository } from './thread-repository';

export async function postMessage(
  repository: ThreadRepository,
  threadId: string,
  author: MessageAuthor,
  text: string,
): Promise<Thread> {
  const parsed = messageDraftSchema.safeParse({ text: text.trim() });
  if (!parsed.success) throw new EmptyMessageError();

  const thread = await repository.getById(threadId);
  if (!thread) throw new ThreadNotFoundError(threadId);

  const next: Thread = {
    ...thread,
    messages: [
      ...thread.messages,
      { id: crypto.randomUUID(), author, text: parsed.data.text, dateLabel: 'Agora' },
    ],
    unread: author === 'resident',
  };

  return repository.save(next);
}
