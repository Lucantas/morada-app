import type { Pool } from 'pg';

import { condoSettingsSchema, type CondoSettings } from '../../domain/condo-settings';
import { SettingsNotFoundError } from '../../domain/errors';
import type { SettingsRepository } from '../../domain/settings-repository';

interface SettingsRow {
  monthly_fee_cents: number;
  due_day: number;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async get(): Promise<CondoSettings> {
    const { rows } = await this.pool.query<SettingsRow>(
      'SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id = $1',
      [this.condominiumId],
    );
    const row = rows[0];
    if (!row) throw new SettingsNotFoundError();
    return condoSettingsSchema.parse({
      monthlyFeeCents: row.monthly_fee_cents,
      dueDay: row.due_day,
    });
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    const parsed = condoSettingsSchema.parse(settings);
    const result = await this.pool.query(
      `UPDATE condo_settings SET monthly_fee_cents = $2, due_day = $3
       WHERE condominium_id = $1
       RETURNING condominium_id`,
      [this.condominiumId, parsed.monthlyFeeCents, parsed.dueDay],
    );
    if (result.rows.length === 0) throw new SettingsNotFoundError();
    return parsed;
  }
}
