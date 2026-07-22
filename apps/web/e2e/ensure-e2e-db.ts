import { Client } from 'pg';

const MAINTENANCE_DB_URL = 'postgres://morada:morada@localhost:5433/morada';
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

// Playwright's `webServer` plugin starts the API/web servers before the
// `globalSetup` file runs, so the API's own DB-connect-and-migrate-at-boot
// would race an empty `morada_e2e`. Running this file directly (via `tsx`) as
// the first step of the API's webServer `command` closes that race.
if (import.meta.url === `file://${process.argv[1]}`) {
  await ensureE2eDatabaseExists();
}
