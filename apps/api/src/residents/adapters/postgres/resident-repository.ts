import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { ApartmentOccupiedError } from '../../domain/errors';
import { residentSchema, type Resident } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

interface ResidentRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  apartment_id: string;
  apt: string;
  active: boolean;
}

const SELECT = `
  SELECT r.id, r.name, r.phone, r.email, r.status,
         ar.apartment_id AS apartment_id, a.label AS apt, ar.active AS active
  FROM residents r
  JOIN apartment_residents ar ON ar.resident_id = r.id
  JOIN apartments a ON a.id = ar.apartment_id`;

function toResident(row: ResidentRow): Resident {
  return residentSchema.parse({
    id: row.id,
    name: row.name,
    apt: row.apt,
    apartmentId: row.apartment_id,
    phone: row.phone,
    email: row.email,
    status: row.status,
    active: row.active,
  });
}

export class PostgresResidentRepository implements ResidentRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Resident[]> {
    const { rows } = await this.pool.query<ResidentRow>(
      `${SELECT} WHERE ar.active ORDER BY a.label`,
    );
    return rows.map(toResident);
  }

  async getById(id: string): Promise<Resident | null> {
    const { rows } = await this.pool.query<ResidentRow>(`${SELECT} WHERE r.id = $1`, [id]);
    return rows[0] ? toResident(rows[0]) : null;
  }

  async listByApartment(apartmentId: string): Promise<Resident[]> {
    const { rows } = await this.pool.query<ResidentRow>(
      `${SELECT} WHERE ar.apartment_id = $1 ORDER BY ar.active DESC`,
      [apartmentId],
    );
    return rows.map(toResident);
  }

  async apartmentOf(residentId: string): Promise<{ apartmentId: string; apt: string } | null> {
    const { rows } = await this.pool.query<{ apartmentId: string; apt: string }>(
      `SELECT ar.apartment_id AS "apartmentId", a.label AS apt
       FROM apartment_residents ar JOIN apartments a ON a.id = ar.apartment_id
       WHERE ar.resident_id = $1`,
      [residentId],
    );
    return rows[0] ?? null;
  }

  async save(input: {
    id: string;
    name: string;
    apt: string;
    phone: string;
    email: string;
    status: Resident['status'];
  }): Promise<Resident> {
    const exists = await this.pool.query('SELECT 1 FROM residents WHERE id = $1', [input.id]);
    if ((exists.rowCount ?? 0) > 0) {
      await this.pool.query(
        'UPDATE residents SET name = $2, phone = $3, email = $4, status = $5 WHERE id = $1',
        [input.id, input.name, input.phone, input.email, input.status],
      );
      return this.getByIdOrThrow(input.id);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const apartmentId = await this.apartmentIdForLabel(client, input.apt);
      const occupied = await client.query(
        'SELECT 1 FROM apartment_residents WHERE apartment_id = $1 AND active',
        [apartmentId],
      );
      if ((occupied.rowCount ?? 0) > 0) throw new ApartmentOccupiedError(input.apt);
      await client.query(
        'INSERT INTO residents (id, name, phone, email, status) VALUES ($1, $2, $3, $4, $5)',
        [input.id, input.name, input.phone, input.email, input.status],
      );
      await client.query(
        'INSERT INTO apartment_residents (id, apartment_id, resident_id, active) VALUES ($1, $2, $3, TRUE)',
        [randomUUID(), apartmentId, input.id],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.getByIdOrThrow(input.id);
  }

  async deactivate(id: string): Promise<void> {
    await this.pool.query('UPDATE apartment_residents SET active = FALSE WHERE resident_id = $1', [
      id,
    ]);
  }

  private async apartmentIdForLabel(client: PoolClient, label: string): Promise<string> {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM apartments WHERE label = $1',
      [label],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const id = randomUUID();
    await client.query('INSERT INTO apartments (id, label) VALUES ($1, $2)', [id, label]);
    return id;
  }

  private async getByIdOrThrow(id: string): Promise<Resident> {
    const resident = await this.getById(id);
    if (!resident) throw new Error(`Resident not found after save: ${id}`);
    return resident;
  }
}
