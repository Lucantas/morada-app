const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set in production — refusing to start with the dev fallback.',
  );
}

export type DbDriver = 'sqlite' | 'postgres';

function resolveDriver(): DbDriver {
  const explicit = process.env.DB_DRIVER;
  if (explicit === 'postgres' || explicit === 'sqlite') return explicit;
  return process.env.DATABASE_URL ? 'postgres' : 'sqlite';
}

const dbDriver = resolveDriver();

if (dbDriver === 'postgres' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set when DB_DRIVER=postgres.');
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-morada-secret-change-me',
  dbDriver,
  dbPath: process.env.DB_PATH ?? 'morada.db',
  databaseUrl: process.env.DATABASE_URL,
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  isProduction,
};
