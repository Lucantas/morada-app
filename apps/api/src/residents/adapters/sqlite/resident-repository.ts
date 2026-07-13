import { randomUUID } from 'node:crypto';

import type { Db } from '../../../platform/db';
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
  active: number;
}

const SELECT = `
  SELECT r.id, r.name, r.phone, r.email, r.status,
         ar.apartment_id AS apartment_id, a.label AS apt, ar.active AS active
  FROM residents r
  JOIN apartment_residents ar ON ar.resident_id = r.id
  JOIN apartments a ON a.id = ar.apartment_id`;

function toResident(row: unknown): Resident {
  const r = row as ResidentRow;
  return residentSchema.parse({
    id: r.id,
    name: r.name,
    apt: r.apt,
    apartmentId: r.apartment_id,
    phone: r.phone,
    email: r.email,
    status: r.status,
    active: r.active === 1,
  });
}

export class SqliteResidentRepository implements ResidentRepository {
  constructor(private readonly db: Db) {}

  list(): Resident[] {
    return this.db.prepare(`${SELECT} WHERE ar.active = 1 ORDER BY a.label`).all().map(toResident);
  }

  getById(id: string): Resident | null {
    const row = this.db.prepare(`${SELECT} WHERE r.id = ?`).get(id);
    return row ? toResident(row) : null;
  }

  listByApartment(apartmentId: string): Resident[] {
    return this.db
      .prepare(`${SELECT} WHERE ar.apartment_id = ? ORDER BY ar.active DESC`)
      .all(apartmentId)
      .map(toResident);
  }

  apartmentOf(residentId: string): { apartmentId: string; apt: string } | null {
    const row = this.db
      .prepare(
        `SELECT ar.apartment_id AS apartmentId, a.label AS apt
         FROM apartment_residents ar JOIN apartments a ON a.id = ar.apartment_id
         WHERE ar.resident_id = ?`,
      )
      .get(residentId);
    return row ? (row as { apartmentId: string; apt: string }) : null;
  }

  private apartmentIdForLabel(label: string): string {
    const existing = this.db.prepare('SELECT id FROM apartments WHERE label = ?').get(label) as
      { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID();
    this.db.prepare('INSERT INTO apartments (id, label) VALUES (?, ?)').run(id, label);
    return id;
  }

  save(input: {
    id: string;
    name: string;
    apt: string;
    phone: string;
    email: string;
    status: Resident['status'];
  }): Resident {
    const exists = this.db.prepare('SELECT 1 FROM residents WHERE id = ?').get(input.id);
    if (exists) {
      this.db
        .prepare(
          'UPDATE residents SET name = @name, phone = @phone, email = @email, status = @status WHERE id = @id',
        )
        .run(input);
      return this.getByIdOrThrow(input.id);
    }

    const apartmentId = this.apartmentIdForLabel(input.apt);
    const occupied = this.db
      .prepare('SELECT 1 FROM apartment_residents WHERE apartment_id = ? AND active = 1')
      .get(apartmentId);
    if (occupied) throw new ApartmentOccupiedError(input.apt);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO residents (id, name, phone, email, status) VALUES (@id, @name, @phone, @email, @status)',
        )
        .run(input);
      this.db
        .prepare(
          'INSERT INTO apartment_residents (id, apartment_id, resident_id, active) VALUES (?, ?, ?, 1)',
        )
        .run(randomUUID(), apartmentId, input.id);
    });
    tx();
    return this.getByIdOrThrow(input.id);
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE apartment_residents SET active = 0 WHERE resident_id = ?').run(id);
  }

  private getByIdOrThrow(id: string): Resident {
    const resident = this.getById(id);
    if (!resident) throw new Error(`Resident not found after save: ${id}`);
    return resident;
  }
}
