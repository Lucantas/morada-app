import { config } from './platform/config';
import { createPool } from './platform/postgres/pool';
import { PostgresUserRepository } from './users/adapters/postgres/user-repository';
import { setUserEmail } from './users/app/set-user-email';

const [username, email] = process.argv.slice(2);
if (!username || !email) {
  console.error('Usage: node dist/set-user-email.js <username> <email>');
  process.exit(1);
}

const pool = createPool(config.databaseUrl);
try {
  await setUserEmail(new PostgresUserRepository(pool), username, email);
  console.log(`E-mail set and verified for ${username}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
