import type { Pool } from 'pg';

import { noticeSchema, type Notice } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  audience: string;
  date_label: string;
  dismissed: boolean;
}

const COLUMNS = 'id, title, body, kind, audience, date_label, dismissed';

function toNotice(row: NoticeRow): Notice {
  return noticeSchema.parse({
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    audience: row.audience,
    dateLabel: row.date_label,
    dismissed: row.dismissed,
  });
}

export class PostgresNoticeRepository implements NoticeRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Notice[]> {
    const { rows } = await this.pool.query<NoticeRow>(`SELECT ${COLUMNS} FROM notices`);
    return rows.map(toNotice);
  }

  async getById(id: string): Promise<Notice | null> {
    const { rows } = await this.pool.query<NoticeRow>(
      `SELECT ${COLUMNS} FROM notices WHERE id = $1`,
      [id],
    );
    return rows[0] ? toNotice(rows[0]) : null;
  }

  async save(notice: Notice): Promise<Notice> {
    await this.pool.query(
      `INSERT INTO notices (${COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, body = EXCLUDED.body, kind = EXCLUDED.kind,
         audience = EXCLUDED.audience, date_label = EXCLUDED.date_label,
         dismissed = EXCLUDED.dismissed`,
      [
        notice.id,
        notice.title,
        notice.body,
        notice.kind,
        notice.audience,
        notice.dateLabel,
        notice.dismissed,
      ],
    );
    return notice;
  }

  async remove(id: string): Promise<void> {
    await this.pool.query('DELETE FROM notices WHERE id = $1', [id]);
  }
}
