import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
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

function mount(repo: SettingsRepository) {
  const app = new Hono<ApiEnv>();
  app.onError(onError);
  app.route('/settings', settingsRoutes(repo));
  return app;
}

describe('settings routes', () => {
  it('GET returns the current settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
  });

  it('PUT updates and returns the new settings', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 10 }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
  });

  it('PUT rejects an invalid dueDay', async () => {
    const app = mount(makeRepo({ monthlyFeeCents: 15000, dueDay: 15 }));
    const res = await app.request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyFeeCents: 20000, dueDay: 31 }),
    });
    expect(res.status).toBe(400);
  });
});
