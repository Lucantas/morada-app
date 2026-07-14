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
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  isProduction,
};
