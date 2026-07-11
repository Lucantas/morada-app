const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET must be set in production — refusing to start with the dev fallback.',
  );
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-morada-secret-change-me',
  dbPath: process.env.DB_PATH ?? 'morada.db',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
};
