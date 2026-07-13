import type { Pool } from 'pg';

const DATA_TABLES = [
  'apartment_residents',
  'apartments',
  'residents',
  'accounts',
  'receipts',
  'notices',
  'threads',
  'users',
];

// Empties every data table (keeping the applied-migrations ledger) so each
// contract test starts from a clean, isolated Postgres state.
export async function resetPg(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE ${DATA_TABLES.join(', ')} CASCADE`);
}
