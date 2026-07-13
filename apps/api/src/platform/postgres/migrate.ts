import type { Pool } from 'pg';

import { migrations } from './migrations';

// Applies each pending migration once, inside its own transaction, tracking
// applied ids in _migrations. Idempotent: already-applied migrations are skipped.
export async function migrate(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const result = await client.query<{ id: string }>('SELECT id FROM _migrations');
    const applied = new Set(result.rows.map((row) => row.id));

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO _migrations (id) VALUES ($1)', [migration.id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
