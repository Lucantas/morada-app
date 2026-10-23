import { z } from 'zod';
import type { Pool } from 'pg';

import { ThreadNotFoundError } from '../../domain/errors';
import { messageSchema, threadSchema, type Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

const COLUMNS = 'id, resident_id, apartment_id, resident_name, apt, unread, messages';

interface ThreadRow {
  id: string;
  resident_id: string | null;
  apartment_id: string | null;
  resident_name: string;
  apt: string;
  unread: boolean;
  messages: string;
}

function toThread(row: ThreadRow): Thread {
  const messages = z.array(messageSchema).parse(JSON.parse(row.messages));
  return threadSchema.parse({
    id: row.id,
    residentId: row.resident_id,
    apartmentId: row.apartment_id,
    residentName: row.resident_name,
    apt: row.apt,
    unread: row.unread,
    messages,
  });
}

export class PostgresThreadRepository implements ThreadRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async list(): Promise<Thread[]> {
    const { rows } = await this.pool.query<ThreadRow>(
      `SELECT ${COLUMNS} FROM threads WHERE condominium_id = $1`,
      [this.condominiumId],
    );
    return rows.map(toThread);
  }

  async getById(id: string): Promise<Thread | null> {
    const { rows } = await this.pool.query<ThreadRow>(
      `SELECT ${COLUMNS} FROM threads WHERE id = $1 AND condominium_id = $2`,
      [id, this.condominiumId],
    );
    return rows[0] ? toThread(rows[0]) : null;
  }

  async save(thread: Thread): Promise<Thread> {
    const result = await this.pool.query(
      `INSERT INTO threads (${COLUMNS}, condominium_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         resident_id = EXCLUDED.resident_id, apartment_id = EXCLUDED.apartment_id,
         resident_name = EXCLUDED.resident_name, apt = EXCLUDED.apt,
         unread = EXCLUDED.unread, messages = EXCLUDED.messages
       WHERE threads.condominium_id = EXCLUDED.condominium_id
       RETURNING id`,
      [
        thread.id,
        thread.residentId,
        thread.apartmentId,
        thread.residentName,
        thread.apt,
        thread.unread,
        JSON.stringify(thread.messages),
        this.condominiumId,
      ],
    );
    if (result.rows.length === 0) throw new ThreadNotFoundError(thread.id);
    return thread;
  }
}
