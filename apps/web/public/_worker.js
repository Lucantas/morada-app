const API_ORIGIN = 'https://morada-api.fly.dev';
const PROXIED_PREFIXES = ['/api/', '/auth/', '/me/'];
const CLIENT_IP_HEADER = 'X-Morada-Client-IP';
const PROXY_SECRET_HEADER = 'X-Morada-Proxy-Secret';

function proxiedHeaders(request, env) {
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (env.PROXY_SECRET && clientIp) {
    headers.set(CLIENT_IP_HEADER, clientIp);
    headers.set(PROXY_SECRET_HEADER, env.PROXY_SECRET);
  }
  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isProxied = PROXIED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    if (isProxied) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      return fetch(
        new Request(target, new Request(request, { headers: proxiedHeaders(request, env) })),
      );
    }
    return env.ASSETS.fetch(request);
  },
};
