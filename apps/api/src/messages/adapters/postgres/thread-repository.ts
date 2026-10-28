import { z } from 'zod';
import type { Pool } from 'pg';

import { ThreadNotFoundError } from '../../domain/errors';
import { messageSchema, threadSchema, type Thread } from '../../domain/message';
import type { ThreadRepository } from '../../domain/thread-repository';

const SAVE_COLUMNS = 'id, resident_id, apartment_id, resident_name, apt, unread, messages';
const SELECT = `SELECT t.id, t.resident_id, t.apartment_id, t.resident_name, t.apt, t.messages,
  (t.resident_message_at IS NOT NULL AND (tr.read_at IS NULL OR tr.read_at < t.resident_message_at)) AS unread
  FROM threads t
  LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = $2`;

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

  async list(viewerUserId: string): Promise<Thread[]> {
    const { rows } = await this.pool.query<ThreadRow>(`${SELECT} WHERE t.condominium_id = $1`, [
      this.condominiumId,
      viewerUserId,
    ]);
    return rows.map(toThread);
  }

  async getById(id: string, viewerUserId: string): Promise<Thread | null> {
    const { rows } = await this.pool.query<ThreadRow>(
      `${SELECT} WHERE t.id = $1 AND t.condominium_id = $3`,
      [id, viewerUserId, this.condominiumId],
    );
    return rows[0] ? toThread(rows[0]) : null;
  }

  async save(thread: Thread): Promise<Thread> {
    const result = await this.pool.query(
      `INSERT INTO threads (${SAVE_COLUMNS}, condominium_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         resident_id = EXCLUDED.resident_id, apartment_id = EXCLUDED.apartment_id,
         resident_name = EXCLUDED.resident_name, apt = EXCLUDED.apt,
         messages = EXCLUDED.messages
       WHERE threads.condominium_id = EXCLUDED.condominium_id
       RETURNING id`,
      [
        thread.id,
        thread.residentId,
        thread.apartmentId,
        thread.residentName,
        thread.apt,
        false,
        JSON.stringify(thread.messages),
        this.condominiumId,
      ],
    );
    if (result.rows.length === 0) throw new ThreadNotFoundError(thread.id);
    return thread;
  }

  async recordResidentMessage(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE threads SET resident_message_at = now() WHERE id = $1 AND condominium_id = $2',
      [id, this.condominiumId],
    );
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO thread_reads (thread_id, user_id, condominium_id, read_at)
       SELECT id, $2, condominium_id, now() FROM threads WHERE id = $1 AND condominium_id = $3
       ON CONFLICT (thread_id, user_id) DO UPDATE SET read_at = EXCLUDED.read_at`,
      [id, userId, this.condominiumId],
    );
  }
}
