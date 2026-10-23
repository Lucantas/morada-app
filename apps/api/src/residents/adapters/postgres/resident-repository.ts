import { randomUUID } from 'node:crypto';

import type { Pool, PoolClient } from 'pg';

import { ApartmentOccupiedError, ResidentNotFoundError } from '../../domain/errors';
import { residentSchema, type Resident } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

interface ResidentRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  status_override: string | null;
  apartment_id: string;
  apt: string;
  active: boolean;
}

const SELECT = `
  SELECT r.id, r.name, r.phone, r.email, r.status, r.status_override,
         ar.apartment_id AS apartment_id, a.label AS apt, ar.active AS active
  FROM residents r
  JOIN apartment_residents ar ON ar.resident_id = r.id
  JOIN apartments a ON a.id = ar.apartment_id
  WHERE r.condominium_id = $1 AND a.condominium_id = $1`;

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
    statusOverride: row.status_override ?? null,
  });
}

export class PostgresResidentRepository implements ResidentRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async list(): Promise<Resident[]> {
    const { rows } = await this.pool.query<ResidentRow>(
      `${SELECT} AND ar.active ORDER BY a.label`,
      [this.condominiumId],
    );
    return rows.map(toResident);
  }

  async getById(id: string): Promise<Resident | null> {
    const { rows } = await this.pool.query<ResidentRow>(`${SELECT} AND r.id = $2`, [
      this.condominiumId,
      id,
    ]);
    return rows[0] ? toResident(rows[0]) : null;
  }

  async listByApartment(apartmentId: string): Promise<Resident[]> {
    const { rows } = await this.pool.query<ResidentRow>(
      `${SELECT} AND ar.apartment_id = $2 ORDER BY ar.active DESC`,
      [this.condominiumId, apartmentId],
    );
    return rows.map(toResident);
  }

  async apartmentOf(residentId: string): Promise<{ apartmentId: string; apt: string } | null> {
    const { rows } = await this.pool.query<{ apartmentId: string; apt: string }>(
      `SELECT ar.apartment_id AS "apartmentId", a.label AS apt
       FROM apartment_residents ar JOIN apartments a ON a.id = ar.apartment_id
       WHERE ar.resident_id = $1 AND a.condominium_id = $2`,
      [residentId, this.condominiumId],
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
    const exists = await this.pool.query<{ condominium_id: string }>(
      'SELECT condominium_id FROM residents WHERE id = $1',
      [input.id],
    );
    const owner = exists.rows[0]?.condominium_id;
    if (owner !== undefined && owner !== this.condominiumId) {
      throw new ResidentNotFoundError(input.id);
    }
    if (owner !== undefined) {
      await this.pool.query(
        'UPDATE residents SET name = $2, phone = $3, email = $4, status = $5 WHERE id = $1 AND condominium_id = $6',
        [input.id, input.name, input.phone, input.email, input.status, this.condominiumId],
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
        'INSERT INTO residents (id, name, phone, email, status, condominium_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [input.id, input.name, input.phone, input.email, input.status, this.condominiumId],
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
    await this.pool.query(
      `UPDATE apartment_residents SET active = FALSE
       WHERE resident_id = $1
         AND apartment_id IN (SELECT id FROM apartments WHERE condominium_id = $2)`,
      [id, this.condominiumId],
    );
  }

  async setStatusOverride(id: string, status: Resident['status'] | null): Promise<void> {
    await this.pool.query(
      'UPDATE residents SET status_override = $2 WHERE id = $1 AND condominium_id = $3',
      [id, status, this.condominiumId],
    );
  }

  private async apartmentIdForLabel(client: PoolClient, label: string): Promise<string> {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM apartments WHERE condominium_id = $1 AND label = $2',
      [this.condominiumId, label],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const id = randomUUID();
    await client.query('INSERT INTO apartments (id, label, condominium_id) VALUES ($1, $2, $3)', [
      id,
      label,
      this.condominiumId,
    ]);
    return id;
  }

  private async getByIdOrThrow(id: string): Promise<Resident> {
    const resident = await this.getById(id);
    if (!resident) throw new Error(`Resident not found after save: ${id}`);
    return resident;
  }
}
