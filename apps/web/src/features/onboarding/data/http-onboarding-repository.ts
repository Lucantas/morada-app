import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';

import type { OnboardingRepository } from '../domain/onboarding-repository';

const myCondosSchema = z.array(
  z.object({ id: z.string(), onboardingPending: z.boolean().default(false) }),
);

export class HttpOnboardingRepository implements OnboardingRepository {
  constructor(private readonly api: ApiClient) {}

  async complete(): Promise<void> {
    await this.api.post('/api/onboarding/complete', {});
  }

  async isPending(condoId: string): Promise<boolean> {
    const condos = myCondosSchema.parse(await this.api.get('/me/condos'));
    return condos.find((condo) => condo.id === condoId)?.onboardingPending ?? false;
  }
}
