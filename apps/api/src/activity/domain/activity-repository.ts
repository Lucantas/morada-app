import type { ActivityEntry, ActivityRecord } from './activity';

export interface ActivityRepository {
  record(entry: ActivityRecord): Promise<void>;
  latest(limit: number): Promise<ActivityEntry[]>;
}
