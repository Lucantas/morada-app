import type { ActivityEntry } from './activity';

export interface ActivityRepository {
  list(): Promise<ActivityEntry[]>;
}
