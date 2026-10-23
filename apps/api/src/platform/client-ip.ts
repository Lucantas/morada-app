import { createHash, timingSafeEqual } from 'node:crypto';

import { config } from './config';

type HeaderSource = { req: { header: (name: string) => string | undefined } };

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isTrustedProxy(presented: string | undefined, expected: string | null): boolean {
  if (expected === null || presented === undefined) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

function proxiedClientIp(c: HeaderSource, proxySecret: string | null): string | undefined {
  if (!isTrustedProxy(c.req.header('X-Morada-Proxy-Secret'), proxySecret)) return undefined;
  return c.req.header('X-Morada-Client-IP')?.trim() || undefined;
}

export function clientIpFrom(
  c: HeaderSource,
  proxySecret: string | null = config.proxySecret,
): string {
  return (
    proxiedClientIp(c, proxySecret) ??
    c.req.header('Fly-Client-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
