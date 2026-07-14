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

// Parameterised bulk insert used to seed the test fixtures. Values are taken from
// each row in column order; booleans/nulls/JSON strings pass straight through.
export async function insertRows(
  pool: Pool,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<void> {
  const columnList = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  for (const row of rows) {
    await pool.query(
      `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
      columns.map((column) => row[column]),
    );
  }
}
