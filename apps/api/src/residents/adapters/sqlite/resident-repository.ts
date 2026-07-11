import type { Db } from '../../../platform/db';
import { residentSchema, type Resident } from '../../domain/resident';
import type { ResidentRepository } from '../../domain/resident-repository';

const COLUMNS = 'id, name, apt, phone, email, status';

function toResident(row: unknown): Resident {
  return residentSchema.parse(row);
}

export class SqliteResidentRepository implements ResidentRepository {
  constructor(private readonly db: Db) {}

  list(): Resident[] {
    const rows = this.db.prepare(`SELECT ${COLUMNS} FROM residents`).all();
    return rows.map(toResident);
  }

  getById(id: string): Resident | null {
    const row = this.db.prepare(`SELECT ${COLUMNS} FROM residents WHERE id = ?`).get(id);
    return row ? toResident(row) : null;
  }

  save(resident: Resident): Resident {
    this.db
      .prepare(
        `INSERT INTO residents (${COLUMNS}) VALUES (@id, @name, @apt, @phone, @email, @status)
         ON CONFLICT(id) DO UPDATE SET
           name = @name, apt = @apt, phone = @phone, email = @email, status = @status`,
      )
      .run(resident);
    return resident;
  }
}
