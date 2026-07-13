import { Pool } from 'pg';

export type PgPool = Pool;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
