import { EmptyMessageError } from './errors';
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
  return repository.addMessage(threadId, author, parsed.data.text);
}
