import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';

import type { PlacedApartment } from '../../domain/building';
import type { BuildingRepository } from '../../domain/building-repository';
import { ApartmentConflictError, ApartmentNotFoundError } from '../../domain/errors';

interface ApartmentRow {
  id: string;
  label: string;
  block: string | null;
  floor: number | null;
  position: number | null;
}

const COLUMNS = 'id, label, block, floor, position';
const UNIQUE_VIOLATION = '23505';

function toPlaced(row: ApartmentRow): PlacedApartment {
  return {
    id: row.id,
    label: row.label,
    block: row.block,
    floor: row.floor,
    position: row.position,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export class PostgresBuildingRepository implements BuildingRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async listActive(): Promise<PlacedApartment[]> {
    const { rows } = await this.pool.query<ApartmentRow>(
      `SELECT ${COLUMNS} FROM apartments WHERE condominium_id = $1 AND active ORDER BY label`,
      [this.condominiumId],
    );
    return rows.map(toPlaced);
  }

  async add(input: {
    label: string;
    block: string | null;
    floor: number | null;
  }): Promise<PlacedApartment> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT 1 FROM condominiums WHERE id = $1 FOR UPDATE', [
        this.condominiumId,
      ]);
      const existing = await client.query<{ id: string; active: boolean }>(
        'SELECT id, active FROM apartments WHERE condominium_id = $1 AND label = $2',
        [this.condominiumId, input.label],
      );
      const found = existing.rows[0];
      if (found?.active) throw new ApartmentConflictError();

      const position = await this.nextPosition(client, input.block, input.floor);
      const id = found?.id ?? randomUUID();
      const sql = found
        ? `UPDATE apartments SET active = TRUE, block = $3, floor = $4, position = $5
           WHERE id = $1 AND condominium_id = $2 RETURNING ${COLUMNS}`
        : `INSERT INTO apartments (id, condominium_id, label, block, floor, position)
           VALUES ($1, $2, $6, $3, $4, $5) RETURNING ${COLUMNS}`;
      const params: unknown[] = [id, this.condominiumId, input.block, input.floor, position];
      if (!found) params.push(input.label);
      const { rows } = await client.query<ApartmentRow>(sql, params);
      await client.query('COMMIT');
      return toPlaced(this.firstRow(rows));
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) throw new ApartmentConflictError();
      throw error;
    } finally {
      client.release();
    }
  }

  async rename(id: string, label: string): Promise<PlacedApartment> {
    try {
      const { rows } = await this.pool.query<ApartmentRow>(
        `UPDATE apartments SET label = $3 WHERE id = $1 AND condominium_id = $2
         RETURNING ${COLUMNS}`,
        [id, this.condominiumId, label],
      );
      const row = rows[0];
      if (!row) throw new ApartmentNotFoundError();
      return toPlaced(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApartmentConflictError();
      throw error;
    }
  }

  async deactivate(id: string): Promise<void> {
    const result = await this.pool.query(
      'UPDATE apartments SET active = FALSE WHERE id = $1 AND condominium_id = $2',
      [id, this.condominiumId],
    );
    if ((result.rowCount ?? 0) === 0) throw new ApartmentNotFoundError();
  }

  async hasActiveResident(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `SELECT 1 FROM apartment_residents ar
       JOIN apartments a ON a.id = ar.apartment_id
       WHERE ar.apartment_id = $1 AND a.condominium_id = $2 AND ar.active`,
      [id, this.condominiumId],
    );
    return (rowCount ?? 0) > 0;
  }

  private async nextPosition(
    client: { query: Pool['query'] },
    block: string | null,
    floor: number | null,
  ): Promise<number | null> {
    if (floor === null) return null;
    const { rows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM apartments
       WHERE condominium_id = $1 AND active AND floor = $2 AND block IS NOT DISTINCT FROM $3`,
      [this.condominiumId, floor, block],
    );
    return rows[0]?.next ?? 1;
  }

  private firstRow(rows: ApartmentRow[]): ApartmentRow {
    const row = rows[0];
    if (!row) throw new Error('Apartment not returned after write');
    return row;
  }
}
