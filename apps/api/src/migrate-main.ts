import { config } from './platform/config';
import { migrate } from './platform/postgres/migrate';
import { createPool } from './platform/postgres/pool';

const pool = createPool(config.databaseUrl);
try {
  await migrate(pool);
  console.log('Morada migrations applied');
} finally {
  await pool.end();
}
