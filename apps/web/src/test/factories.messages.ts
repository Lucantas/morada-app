import type { Message, Thread } from '@/features/messages/domain/message';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: nextId('message'),
    author: 'resident',
    text: 'Olá, síndico!',
    dateLabel: 'Agora',
    ...overrides,
  };
}

export function buildThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: nextId('thread'),
    residentName: 'Maria Ribeiro',
    apt: 'Apto 302',
    messages: [buildMessage()],
    unread: false,
    ...overrides,
  };
}
