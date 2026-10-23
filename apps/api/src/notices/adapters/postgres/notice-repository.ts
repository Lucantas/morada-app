import type { Pool } from 'pg';

import { NoticeNotFoundError } from '../../domain/errors';
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

const BASE_COLUMNS = 'id, title, body, kind, audience, date_label';

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
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async list(viewerResidentId: string | null): Promise<Notice[]> {
    if (viewerResidentId === null) {
      const { rows } = await this.pool.query<NoticeRow>(
        `SELECT ${BASE_COLUMNS}, false AS dismissed FROM notices WHERE condominium_id = $1`,
        [this.condominiumId],
      );
      return rows.map(toNotice);
    }

    const { rows } = await this.pool.query<NoticeRow>(
      `SELECT n.id, n.title, n.body, n.kind, n.audience, n.date_label,
              (d.resident_id IS NOT NULL) AS dismissed
       FROM notices n
       LEFT JOIN notice_dismissals d
         ON d.notice_id = n.id AND d.resident_id = $1
       WHERE n.condominium_id = $2`,
      [viewerResidentId, this.condominiumId],
    );
    return rows.map(toNotice);
  }

  async getById(id: string): Promise<Notice | null> {
    const { rows } = await this.pool.query<NoticeRow>(
      `SELECT ${BASE_COLUMNS}, false AS dismissed FROM notices
       WHERE id = $1 AND condominium_id = $2`,
      [id, this.condominiumId],
    );
    return rows[0] ? toNotice(rows[0]) : null;
  }

  async save(notice: Notice): Promise<Notice> {
    const result = await this.pool.query(
      `INSERT INTO notices (${BASE_COLUMNS}, condominium_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, body = EXCLUDED.body, kind = EXCLUDED.kind,
         audience = EXCLUDED.audience, date_label = EXCLUDED.date_label
       WHERE notices.condominium_id = EXCLUDED.condominium_id
       RETURNING id`,
      [
        notice.id,
        notice.title,
        notice.body,
        notice.kind,
        notice.audience,
        notice.dateLabel,
        this.condominiumId,
      ],
    );
    if (result.rows.length === 0) throw new NoticeNotFoundError(notice.id);
    return { ...notice, dismissed: false };
  }

  async dismiss(noticeId: string, residentId: string): Promise<Notice> {
    await this.pool.query(
      `INSERT INTO notice_dismissals (notice_id, resident_id)
       SELECT id, $2 FROM notices WHERE id = $1 AND condominium_id = $3
       ON CONFLICT DO NOTHING`,
      [noticeId, residentId, this.condominiumId],
    );
    const notice = await this.getById(noticeId);
    if (!notice) throw new NoticeNotFoundError(noticeId);
    return { ...notice, dismissed: true };
  }

  async remove(id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM notice_dismissals
       WHERE notice_id IN (SELECT id FROM notices WHERE id = $1 AND condominium_id = $2)`,
      [id, this.condominiumId],
    );
    await this.pool.query('DELETE FROM notices WHERE id = $1 AND condominium_id = $2', [
      id,
      this.condominiumId,
    ]);
  }
}
