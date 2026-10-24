import { Hono } from 'hono';

import type { ApiEnv, Permission } from '../../../platform/auth';
import { onError } from '../../../platform/http-error';
import type { CondoSettings } from '../../domain/condo-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

import { settingsRoutes } from './routes';

function makeRepo(initial: CondoSettings): SettingsRepository {
  let current = initial;
  return {
    get: async () => current,
    save: async (s) => {
      current = s;
      return s;
    },
  };
}

function mount(repo: SettingsRepository, permissions: readonly Permission[] = ['manage_fees']) {
  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.use('*', async (c, next) => {
    c.set('permissions', permissions);
    await next();
  });
  app.route(
    '/settings',
    settingsRoutes(() => ({ settings: repo })),
  );
  return app;
}

describe('settings routes', () => {
  it('GET returns the current settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null }));
    const res = await app.request('/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
  });

  it('PUT updates and returns the new settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 10 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 20000, dueDay: 10, pix: null });
  });

  it('PUT rejects an invalid dueDay', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 31 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT without manage_fees answers 403 and keeps the settings', async () => {
    const repo = makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
    const app = mount(repo, ['manage_money']);
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 10 }),
    });
    expect(res.status).toBe(403);
    expect(await repo.get()).toEqual({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
  });

  describe('pix', () => {
    const pix = {
      keyType: 'cpf',
      key: '123.456.789-09',
      receiverName: 'Condomínio Morada',
      city: 'Santos',
    } as const;
    const stored = { ...pix, key: '12345678909' };

    function put(app: ReturnType<typeof mount>, body: unknown) {
      return app.request('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    it('PUT stores a normalized pix key', async () => {
      const repo = makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
      const app = mount(repo);

      const res = await put(app, { monthlyFeeCents: 15000, dueDay: 15, pix });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15, pix: stored });
      expect((await repo.get()).pix).toEqual(stored);
    });

    it('PUT without a pix field keeps the configured key', async () => {
      const repo = makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: stored });
      const app = mount(repo);

      const res = await put(app, { monthlyFeeCents: 20000, dueDay: 10 });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ monthlyFeeCents: 20000, dueDay: 10, pix: stored });
    });

    it('PUT with pix null clears the configured key', async () => {
      const repo = makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: stored });
      const app = mount(repo);

      const res = await put(app, { monthlyFeeCents: 15000, dueDay: 15, pix: null });

      expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
      expect((await repo.get()).pix).toBeNull();
    });

    it.each([
      ['key', { ...pix, key: '111.111.111-11' }, 'Chave Pix inválida'],
      ['receiver', { ...pix, receiverName: '' }, 'Informe o nome do recebedor (até 25 caracteres)'],
      ['city', { ...pix, city: 'x'.repeat(16) }, 'Informe a cidade (até 15 caracteres)'],
    ])('PUT answers 400 for an invalid %s', async (_label, invalid, message) => {
      const repo = makeRepo({ monthlyFeeCents: 15000, dueDay: 15, pix: null });
      const app = mount(repo);

      const res = await put(app, { monthlyFeeCents: 15000, dueDay: 15, pix: invalid });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: message });
      expect((await repo.get()).pix).toBeNull();
    });
  });
});
