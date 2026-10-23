import { clientIpFrom } from './client-ip';

function ctx(headers: Record<string, string>) {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { req: { header: (name: string) => lower.get(name.toLowerCase()) } };
}

const proxied = {
  'X-Morada-Client-IP': '203.0.113.7',
  'X-Morada-Proxy-Secret': 'segredo-do-proxy',
  'Fly-Client-IP': '104.16.0.1',
};

describe('clientIpFrom', () => {
  test('trusts the proxy client IP when the proxy secret matches', () => {
    expect(clientIpFrom(ctx(proxied), 'segredo-do-proxy')).toBe('203.0.113.7');
  });

  test('ignores the proxy client IP when the secret is wrong', () => {
    expect(clientIpFrom(ctx(proxied), 'outro-segredo')).toBe('104.16.0.1');
  });

  test('ignores the proxy client IP when no proxy secret is configured', () => {
    expect(clientIpFrom(ctx(proxied), null)).toBe('104.16.0.1');
  });

  test('ignores the proxy client IP when the request carries no secret', () => {
    const headers = { 'X-Morada-Client-IP': '203.0.113.7', 'Fly-Client-IP': '104.16.0.1' };
    expect(clientIpFrom(ctx(headers), 'segredo-do-proxy')).toBe('104.16.0.1');
  });

  test('falls back to the first X-Forwarded-For entry, then unknown', () => {
    expect(clientIpFrom(ctx({ 'X-Forwarded-For': ' 9.9.9.9 , 10.0.0.1' }), null)).toBe('9.9.9.9');
    expect(clientIpFrom(ctx({}), null)).toBe('unknown');
  });
});
