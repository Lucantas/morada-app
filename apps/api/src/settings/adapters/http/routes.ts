import { Hono } from 'hono';

import { requirePermission, type ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { getSettings } from '../../app/get-settings';
import { updateSettings } from '../../app/update-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

interface SettingsRoutesDeps {
  settings: SettingsRepository;
}

export function settingsRoutes(scope: Scoped<SettingsRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await getSettings(scope(c.get('condoId')).settings)));

  app.put('/', requirePermission('manage_fees'), async (c) =>
    c.json(await updateSettings(scope(c.get('condoId')).settings, await c.req.json())),
  );

  return app;
}
