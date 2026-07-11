export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-morada-secret-change-me',
  dbPath: process.env.DB_PATH ?? 'morada.db',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
};
