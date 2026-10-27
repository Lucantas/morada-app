import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { getSettings } from '../../app/get-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

interface PixRoutesDeps {
  settings: SettingsRepository;
}

export function pixRoutes(scope: Scoped<PixRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => {
    const { pix } = await getSettings(scope(c.get('condoId')).settings);
    if (!pix) return c.json({ configured: false as const });
    return c.json({
      configured: true as const,
      key: pix.key,
      receiverName: pix.receiverName,
      city: pix.city,
    });
  });

  return app;
}
