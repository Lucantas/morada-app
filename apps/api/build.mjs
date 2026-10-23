import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts', 'src/migrate-main.ts', 'src/set-user-email.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outdir: 'dist',
  external: ['pg-native'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
