import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Dev only: let `make start-tunnel` serve the app through one HTTPS cloudflared
  // origin and proxy API/auth to the local API, so a phone on any network reaches
  // it with no CORS. Ignored by `vite build`/production.
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': apiProxyTarget,
      '/auth': apiProxyTarget,
    },
  },
});
