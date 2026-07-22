import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

function pascal(name) {
  return name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

export function render(template, name) {
  return template.replaceAll('__feature__', name).replaceAll('__Feature__', pascal(name));
}

const API_TEMPLATES = [
  ['domain/__feature__.ts.tmpl', 'domain/__feature__.ts'],
  ['domain/__feature__-repository.ts.tmpl', 'domain/__feature__-repository.ts'],
  ['domain/errors.ts.tmpl', 'domain/errors.ts'],
  ['app/list-__feature__.ts.tmpl', 'app/list-__feature__.ts'],
  ['adapters/http/routes.ts.tmpl', 'adapters/http/routes.ts'],
  ['adapters/http/routes.test.ts.tmpl', 'adapters/http/routes.test.ts'],
];

const WEB_TEMPLATES = [
  ['domain/__feature__.ts.tmpl', 'domain/__feature__.ts'],
  ['domain/__feature__.test.ts.tmpl', 'domain/__feature__.test.ts'],
  ['domain/__feature__-repository.ts.tmpl', 'domain/__feature__-repository.ts'],
  ['data/http-__feature__-repository.ts.tmpl', 'data/http-__feature__-repository.ts'],
  ['ui/use-__feature__.ts.tmpl', 'ui/use-__feature__.ts'],
  ['ui/__Feature__Screen.tsx.tmpl', 'ui/__Feature__Screen.tsx'],
];

function baseDir(app) {
  return app === 'api' ? `apps/api/src` : `apps/web/src/features`;
}

export function planFiles({ app, name }) {
  const templates = app === 'api' ? API_TEMPLATES : WEB_TEMPLATES;
  const root = `${baseDir(app)}/${name}`;
  return templates.map(([from, to]) => ({
    from: `scripts/feature-templates/${app}/${from}`,
    to: render(`${root}/${to}`, name),
  }));
}

export function validate({ app, name, spec, specExists, dirExists = existsSync }) {
  if (app !== 'api' && app !== 'web') throw new Error('app must be "api" or "web"');
  if (!/^[a-z][a-z0-9-]*$/.test(name ?? '')) throw new Error('name must be kebab-case');
  if (!spec) throw new Error('spec=<path> is required (a design doc under docs/superpowers/specs)');
  if (!specExists(spec)) throw new Error(`spec file not found: ${spec}`);
  if (dirExists(`${baseDir(app)}/${name}`)) throw new Error(`feature dir already exists: ${name}`);
}

function argOf(key) {
  const hit = process.argv.find((a) => a.startsWith(`${key}=`));
  return hit ? hit.slice(key.length + 1) : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = argOf('app');
  const name = argOf('name');
  const spec = argOf('spec');
  try {
    validate({ app, name, spec, specExists: (p) => existsSync(p) });
  } catch (error) {
    console.error(`[new-feature] ${error.message}`);
    process.exit(1);
  }
  for (const { from, to } of planFiles({ app, name })) {
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, render(readFileSync(from, 'utf8'), name));
    console.log(`created ${to}`);
  }
  console.log(
    `\nNext: implement domain → ${app === 'api' ? 'app → adapters' : 'data → ui'} (TDD). Spec: ${spec}`,
  );
}
