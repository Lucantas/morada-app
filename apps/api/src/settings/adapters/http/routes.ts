import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getSettings } from '../../app/get-settings';
import { updateSettings } from '../../app/update-settings';
import type { SettingsRepository } from '../../domain/settings-repository';

export function settingsRoutes(repo: SettingsRepository): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await getSettings(repo)));

  app.put('/', async (c) => c.json(await updateSettings(repo, await c.req.json())));

  return app;
}
