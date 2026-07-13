import { z } from 'zod';

import type { Db } from '../../../platform/db';
import { messageSchema, threadSchema, type Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

const COLUMNS = 'id, resident_name, apt, unread, messages';

const rowSchema = z.object({
  id: z.string(),
  resident_name: z.string(),
  apt: z.string(),
  unread: z.number(),
  messages: z.string(),
});

function toThread(row: unknown): Thread {
  const parsed = rowSchema.parse(row);
  const messages = z.array(messageSchema).parse(JSON.parse(parsed.messages));
  return threadSchema.parse({
    id: parsed.id,
    residentName: parsed.resident_name,
    apt: parsed.apt,
    unread: parsed.unread !== 0,
    messages,
  });
}

export class SqliteThreadRepository implements ThreadRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<Thread[]> {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM threads`).all();
    return rows.map(toThread);
  }

  async getById(id: string): Promise<Thread | null> {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM threads WHERE id = ?`).get(id);
    return row ? toThread(row) : null;
  }

  async save(thread: Thread): Promise<Thread> {
    this.db
      .prepare(
        `INSERT INTO threads (${COLUMNS}) VALUES (@id, @resident_name, @apt, @unread, @messages)
         ON CONFLICT(id) DO UPDATE SET
           resident_name = @resident_name, apt = @apt, unread = @unread, messages = @messages`,
      )
      .run({
        id: thread.id,
        resident_name: thread.residentName,
        apt: thread.apt,
        unread: thread.unread ? 1 : 0,
        messages: JSON.stringify(thread.messages),
      });
    return thread;
  }
}
