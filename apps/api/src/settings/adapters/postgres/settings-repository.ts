import type { Pool } from 'pg';

import { condoSettingsSchema, type CondoSettings } from '../../domain/condo-settings';
import { SettingsNotFoundError } from '../../domain/errors';
import type { SettingsRepository } from '../../domain/settings-repository';

interface SettingsRow {
  monthly_fee_cents: number;
  due_day: number;
  pix_key_type: string | null;
  pix_key: string | null;
  pix_receiver_name: string | null;
  pix_city: string | null;
  opening_balance_cents: number | null;
  opening_balance_date: string | null;
}

export class PostgresSettingsRepository implements SettingsRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async get(): Promise<CondoSettings> {
    const { rows } = await this.pool.query<SettingsRow>(
      `SELECT monthly_fee_cents, due_day, pix_key_type, pix_key, pix_receiver_name, pix_city,
         opening_balance_cents, opening_balance_date::text AS opening_balance_date
       FROM condo_settings WHERE condominium_id = $1`,
      [this.condominiumId],
    );
    const row = rows[0];
    if (!row) throw new SettingsNotFoundError();
    return condoSettingsSchema.parse({
      monthlyFeeCents: row.monthly_fee_cents,
      dueDay: row.due_day,
      pix:
        row.pix_key_type === null
          ? null
          : {
              keyType: row.pix_key_type,
              key: row.pix_key,
              receiverName: row.pix_receiver_name,
              city: row.pix_city,
            },
      openingBalance:
        row.opening_balance_cents === null
          ? null
          : { valueCents: row.opening_balance_cents, date: row.opening_balance_date },
    });
  }

  async save(settings: CondoSettings): Promise<CondoSettings> {
    const parsed = condoSettingsSchema.parse(settings);
    const result = await this.pool.query(
      `UPDATE condo_settings SET monthly_fee_cents = $2, due_day = $3,
         pix_key_type = $4, pix_key = $5, pix_receiver_name = $6, pix_city = $7,
         opening_balance_cents = $8, opening_balance_date = $9
       WHERE condominium_id = $1
       RETURNING condominium_id`,
      [
        this.condominiumId,
        parsed.monthlyFeeCents,
        parsed.dueDay,
        parsed.pix?.keyType ?? null,
        parsed.pix?.key ?? null,
        parsed.pix?.receiverName ?? null,
        parsed.pix?.city ?? null,
        parsed.openingBalance?.valueCents ?? null,
        parsed.openingBalance?.date ?? null,
      ],
    );
    if (result.rows.length === 0) throw new SettingsNotFoundError();
    return parsed;
  }
}
