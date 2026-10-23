import type { Pool } from 'pg';

import { condoSettingsSchema, type CondoSettings } from '../../domain/condo-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

const LEGACY_CONDOMINIUM_ID = 'condo-legacy';

interface SettingsRow {
  monthly_fee_cents: number;
  due_day: number;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<CondoSettings> {
    const { rows } = await this.pool.query<SettingsRow>(
      'SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id = $1',
      [LEGACY_CONDOMINIUM_ID],
    );
    const row = rows[0];
    return condoSettingsSchema.parse({
      monthlyFeeCents: row?.monthly_fee_cents ?? 15000,
      dueDay: row?.due_day ?? 15,
    });
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    const parsed = condoSettingsSchema.parse(settings);
    await this.pool.query(
      `INSERT INTO condo_settings (condominium_id, monthly_fee_cents, due_day)
       VALUES ($1, $2, $3)
       ON CONFLICT (condominium_id) DO UPDATE SET
         monthly_fee_cents = EXCLUDED.monthly_fee_cents, due_day = EXCLUDED.due_day`,
      [LEGACY_CONDOMINIUM_ID, parsed.monthlyFeeCents, parsed.dueDay],
    );
    return parsed;
  }
}
