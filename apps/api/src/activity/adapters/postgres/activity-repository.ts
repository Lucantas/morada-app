import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import {
  activityActionSchema,
  activityEntrySchema,
  type ActivityEntry,
  type ActivityRecord,
} from '../../domain/activity';
import type { ActivityRepository } from '../../domain/activity-repository';

interface ActivityRow {
  id: string;
  action: string;
  actor_name: string;
  subject_id: string | null;
  created_at: Date;
}

export class PostgresActivityRepository implements ActivityRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async record(entry: ActivityRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO activity_log (id, condominium_id, actor_user_id, action, subject_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        this.condominiumId,
        entry.actorUserId,
        entry.action,
        entry.subjectId,
        entry.at,
      ],
    );
  }

  async latest(limit: number): Promise<ActivityEntry[]> {
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT l.id, l.action, l.subject_id, l.created_at,
              COALESCE(NULLIF(u.name, ''), NULLIF(u.email, ''), u.username, '') AS actor_name
       FROM activity_log l
       JOIN users u ON u.id = l.actor_user_id
       WHERE l.condominium_id = $1
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT $2`,
      [this.condominiumId, limit],
    );
    return rows
      .filter((row) => activityActionSchema.safeParse(row.action).success)
      .map((row) =>
        activityEntrySchema.parse({
          id: row.id,
          action: row.action,
          actorName: row.actor_name,
          subjectId: row.subject_id,
          at: row.created_at,
        }),
      );
  }
}
