const API_ORIGIN = 'https://morada-api.fly.dev';
const PROXIED_PREFIXES = ['/api/', '/auth/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isProxied = PROXIED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
    if (isProxied) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      return fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
