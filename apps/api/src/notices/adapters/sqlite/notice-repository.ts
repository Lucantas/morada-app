import type { Db } from '../../../platform/db';
import { noticeSchema, type Notice } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

const COLUMNS = 'id, title, body, kind, audience, date_label, dismissed';

function toNotice(row: unknown): Notice {
  const record = row as {
    id: string;
    title: string;
    body: string;
    kind: string;
    audience: string;
    date_label: string;
    dismissed: number;
  };
  return noticeSchema.parse({
    id: record.id,
    title: record.title,
    body: record.body,
    kind: record.kind,
    audience: record.audience,
    dateLabel: record.date_label,
    dismissed: record.dismissed === 1,
  });
}

export class SqliteNoticeRepository implements NoticeRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<Notice[]> {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM notices`).all();
    return rows.map(toNotice);
  }

  async getById(id: string): Promise<Notice | null> {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM notices WHERE id = ?`).get(id);
    return row ? toNotice(row) : null;
  }

  async save(notice: Notice): Promise<Notice> {
    this.db
      .prepare(
        `INSERT INTO notices (${COLUMNS}) VALUES (@id, @title, @body, @kind, @audience, @dateLabel, @dismissed)
         ON CONFLICT(id) DO UPDATE SET
           title = @title, body = @body, kind = @kind, audience = @audience,
           date_label = @dateLabel, dismissed = @dismissed`,
      )
      .run({
        id: notice.id,
        title: notice.title,
        body: notice.body,
        kind: notice.kind,
        audience: notice.audience,
        dateLabel: notice.dateLabel,
        dismissed: notice.dismissed ? 1 : 0,
      });
    return notice;
  }

  async remove(id: string): Promise<void> {
    this.db.prepare('DELETE FROM notices WHERE id = ?').run(id);
  }
}
