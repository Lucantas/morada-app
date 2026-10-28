import type { Pool } from 'pg';

import {
  pendenciesSchema,
  streetFactsSchema,
  type Pendencies,
  type StreetFacts,
  type StreetWindow,
} from '../../domain/street';
import type { StreetQuery } from '../../domain/street-query';

const DUE_SOON_DAYS = 3;

interface CountRow {
  condominium_id: string;
  n: string;
}

interface WindowRow {
  condominium_id: string;
  block: string | null;
  floor: number;
  position: number;
  lit: boolean;
}

const OVERDUE_RESIDENTS_SQL = `
  SELECT r.condominium_id, count(*) AS n
  FROM residents r
  WHERE r.condominium_id = ANY($1)
    AND EXISTS (
      SELECT 1 FROM apartment_residents ar
      JOIN apartments a ON a.id = ar.apartment_id
      WHERE ar.resident_id = r.id AND ar.active AND a.condominium_id = r.condominium_id
    )
    AND (
      r.status_override = 'atrasado'
      OR (r.status_override IS NULL AND EXISTS (
        SELECT 1 FROM receipts rc
        WHERE rc.resident_id = r.id AND rc.status = 'pendente'
          AND rc.due_date < $2::date AND rc.condominium_id = r.condominium_id
      ))
    )
  GROUP BY r.condominium_id`;

const OVERDUE_ACCOUNTS_SQL = `
  SELECT condominium_id, count(*) AS n
  FROM accounts
  WHERE condominium_id = ANY($1) AND visible AND status <> 'pago'
    AND (status = 'atrasado' OR due_date < $2::date)
  GROUP BY condominium_id`;

const DUE_SOON_SQL = `
  SELECT condominium_id, count(*) AS n
  FROM accounts
  WHERE condominium_id = ANY($1) AND visible AND status <> 'pago' AND status <> 'atrasado'
    AND due_date BETWEEN $2::date AND $2::date + ${DUE_SOON_DAYS}
  GROUP BY condominium_id`;

const PROOFS_SQL = `
  SELECT condominium_id, count(*) AS n
  FROM receipts
  WHERE condominium_id = ANY($1) AND status = 'em_analise'
  GROUP BY condominium_id`;

const UNREAD_SQL = `
  SELECT t.condominium_id, count(*) AS n
  FROM threads t
  LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = $2
  WHERE t.condominium_id = ANY($1)
    AND t.resident_message_at IS NOT NULL
    AND (tr.read_at IS NULL OR tr.read_at < t.resident_message_at)
  GROUP BY t.condominium_id`;

const WINDOWS_SQL = `
  SELECT a.condominium_id, a.block, a.floor, a.position,
    EXISTS (SELECT 1 FROM apartment_residents ar WHERE ar.apartment_id = a.id AND ar.active) AS lit
  FROM apartments a
  WHERE a.condominium_id = ANY($1) AND a.active AND a.floor IS NOT NULL AND a.position IS NOT NULL
  ORDER BY a.block NULLS FIRST, a.floor, a.position`;

export class PostgresStreetQuery implements StreetQuery {
  constructor(private readonly pool: Pool) {}

  async factsFor(
    condoIds: readonly string[],
    viewerUserId: string,
    today: string,
  ): Promise<Map<string, StreetFacts>> {
    const ids = [...condoIds];
    const [overdueResidents, overdueAccounts, dueSoon, proofs, unread, windows] = await Promise.all(
      [
        this.counts(OVERDUE_RESIDENTS_SQL, [ids, today]),
        this.counts(OVERDUE_ACCOUNTS_SQL, [ids, today]),
        this.counts(DUE_SOON_SQL, [ids, today]),
        this.counts(PROOFS_SQL, [ids]),
        this.counts(UNREAD_SQL, [ids, viewerUserId]),
        this.pool.query<WindowRow>(WINDOWS_SQL, [ids]),
      ],
    );
    const windowsByCondo = new Map<string, StreetWindow[]>();
    for (const row of windows.rows) {
      const list = windowsByCondo.get(row.condominium_id) ?? [];
      windowsByCondo.set(row.condominium_id, [
        ...list,
        { block: row.block, floor: row.floor, position: row.position, lit: row.lit },
      ]);
    }
    return new Map(
      ids.map((id) => {
        const pendencies: Pendencies = pendenciesSchema.parse({
          overdueResidents: overdueResidents.get(id) ?? 0,
          overdueAccounts: overdueAccounts.get(id) ?? 0,
          accountsDueSoon: dueSoon.get(id) ?? 0,
          proofsToReview: proofs.get(id) ?? 0,
          unreadThreads: unread.get(id) ?? 0,
        });
        return [id, streetFactsSchema.parse({ pendencies, windows: windowsByCondo.get(id) ?? [] })];
      }),
    );
  }

  private async counts(sql: string, params: unknown[]): Promise<Map<string, number>> {
    const { rows } = await this.pool.query<CountRow>(sql, params);
    return new Map(rows.map((row) => [row.condominium_id, Number(row.n)]));
  }
}
