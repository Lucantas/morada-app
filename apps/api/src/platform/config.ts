export function parseWebOrigins(raw: string | undefined, isProd: boolean): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (origins.length > 0) return origins;
  if (isProd) {
    throw new Error(
      'WEB_ORIGIN must be set in production — refusing to start without an allowlist.',
    );
  }
  return ['http://localhost:5173'];
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set in production — refusing to start with the dev fallback.',
  );
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set — the API runs on Postgres.');
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-morada-secret-change-me',
  databaseUrl,
  webOrigins: parseWebOrigins(process.env.WEB_ORIGIN, isProduction),
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  isProduction,
};
