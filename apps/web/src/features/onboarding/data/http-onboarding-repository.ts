import type { ApiClient } from '@/shared/lib/api-client';

import type { OnboardingRepository } from '../domain/onboarding-repository';

export class HttpOnboardingRepository implements OnboardingRepository {
  constructor(private readonly api: ApiClient) {}

  async complete(): Promise<void> {
    await this.api.post('/api/onboarding/complete', {});
  }
}
