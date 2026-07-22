import { Client } from 'pg';

const MAINTENANCE_DB_URL = 'postgres://morada:morada@localhost:5433/morada';
const E2E_DATABASE_URL = 'postgres://morada:morada@localhost:5433/morada_e2e';
export const E2E_DB_NAME = 'morada_e2e';

export async function ensureE2eDatabaseExists(): Promise<void> {
  const client = new Client({ connectionString: MAINTENANCE_DB_URL });
  await client.connect();
  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      E2E_DB_NAME,
    ]);
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${E2E_DB_NAME}`);
    }
  } finally {
    await client.end();
  }
}

// Resets the e2e database to a clean slate before every `make e2e` run.
// `apartments.label` (and similar) are UNIQUE, so leftover rows from a
// previous run would make the journey spec fail on re-run. Truncating here —
// after the DB is known to exist but before the API boots and seeds the admin
// — means the API's own migrate-at-boot is a no-op and the admin gets
// reseeded into empty tables, giving every run a deterministic starting state.
export async function resetE2eDatabase(): Promise<void> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_migrations'`,
    );
    if (result.rows.length === 0) return;
    const tableNames = result.rows.map((row) => `"${row.tablename}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${tableNames} CASCADE`);
  } finally {
    await client.end();
  }
}

// Playwright's `webServer` plugin starts the API/web servers before the
// `globalSetup` file runs, so the API's own DB-connect-and-migrate-at-boot
// would race an empty `morada_e2e`. Running this file directly (via `tsx`) as
// the first step of the API's webServer `command` closes that race.
if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureE2eDatabaseExists();
  await resetE2eDatabase();
}
