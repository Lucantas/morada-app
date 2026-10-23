export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export function parseR2Config(env: NodeJS.ProcessEnv): R2Config | null {
  const endpoint = env.R2_ENDPOINT;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

export type EmailConfig = {
  accountId: string;
  apiToken: string;
  from: string;
};

export function parseEmailConfig(env: NodeJS.ProcessEnv): EmailConfig | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN;
  const from = env.EMAIL_FROM;
  if (!accountId || !apiToken || !from) return null;
  return { accountId, apiToken, from };
}

export function parseAppUrl(raw: string | undefined, webOrigins: string[]): string {
  const url = raw?.trim() || webOrigins[0] || '';
  return url.replace(/\/+$/, '');
}

export function parseProxySecret(raw: string | undefined): string | null {
  const secret = raw?.trim() ?? '';
  return secret === '' ? null : secret;
}

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

const webOrigins = parseWebOrigins(process.env.WEB_ORIGIN, isProduction);

export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-morada-secret-change-me',
  databaseUrl,
  webOrigins,
  appUrl: parseAppUrl(process.env.APP_URL, webOrigins),
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  isProduction,
  r2: parseR2Config(process.env),
  email: parseEmailConfig(process.env),
  proxySecret: parseProxySecret(process.env.PROXY_SECRET),
};
