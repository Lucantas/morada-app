import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';

import { activityEntrySchema, type ActivityEntry } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';

const activityListSchema = z.array(activityEntrySchema);

export class HttpActivityRepository implements ActivityRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<ActivityEntry[]> {
    return activityListSchema.parse(await this.api.get('/api/activity'));
  }
}
