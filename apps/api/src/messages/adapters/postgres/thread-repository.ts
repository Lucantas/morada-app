import { z } from 'zod';
import type { Pool } from 'pg';

import { messageSchema, threadSchema, type Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

const COLUMNS = 'id, resident_name, apt, unread, messages';

interface ThreadRow {
  id: string;
  resident_name: string;
  apt: string;
  unread: boolean;
  messages: string;
}

function toThread(row: ThreadRow): Thread {
  const messages = z.array(messageSchema).parse(JSON.parse(row.messages));
  return threadSchema.parse({
    id: row.id,
    residentName: row.resident_name,
    apt: row.apt,
    unread: row.unread,
    messages,
  });
}

export class PostgresThreadRepository implements ThreadRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Thread[]> {
    const { rows } = await this.pool.query<ThreadRow>(`SELECT ${COLUMNS} FROM threads`);
    return rows.map(toThread);
  }

  async getById(id: string): Promise<Thread | null> {
    const { rows } = await this.pool.query<ThreadRow>(
      `SELECT ${COLUMNS} FROM threads WHERE id = $1`,
      [id],
    );
    return rows[0] ? toThread(rows[0]) : null;
  }

  async save(thread: Thread): Promise<Thread> {
    await this.pool.query(
      `INSERT INTO threads (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         resident_name = EXCLUDED.resident_name, apt = EXCLUDED.apt,
         unread = EXCLUDED.unread, messages = EXCLUDED.messages`,
      [thread.id, thread.residentName, thread.apt, thread.unread, JSON.stringify(thread.messages)],
    );
    return thread;
  }
}
