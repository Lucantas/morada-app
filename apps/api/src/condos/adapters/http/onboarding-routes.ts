import { Hono } from 'hono';

import { requirePermission, type ApiEnv } from '../../../platform/auth';
import { completeOnboarding } from '../../app/complete-onboarding';
import type { CondoRepository } from '../../domain/condo-repository';

export function onboardingRoutes(condos: Pick<CondoRepository, 'completeOnboarding'>) {
  const app = new Hono<ApiEnv>();
  app.post('/complete', requirePermission('manage_condo'), async (c) => {
    await completeOnboarding(condos, c.get('condoId'));
    return c.body(null, 204);
  });
  return app;
}
