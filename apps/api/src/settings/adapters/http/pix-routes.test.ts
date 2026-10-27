import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { CondoSettings } from '../../domain/condo-settings';

import { pixRoutes } from './pix-routes';

function mount(settings: CondoSettings) {
  const app = new Hono<ApiEnv>();
  app.route(
    '/pix',
    pixRoutes(() => ({ settings: { get: async () => settings, save: async (s) => s } })),
  );
  return app;
}

describe('pix routes', () => {
  it('answers configured false when no key is set', async () => {
    const app = mount({ monthlyFeeCents: 15000, dueDay: 15, pix: null });

    const res = await app.request('/pix');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });

  it('answers the key, receiver and city when configured', async () => {
    const app = mount({
      monthlyFeeCents: 15000,
      dueDay: 15,
      pix: {
        keyType: 'telefone',
        key: '+5511988887777',
        receiverName: 'Condomínio Morada',
        city: 'Santos',
      },
    });

    const res = await app.request('/pix');

    expect(await res.json()).toEqual({
      configured: true,
      key: '+5511988887777',
      receiverName: 'Condomínio Morada',
      city: 'Santos',
    });
  });
});
