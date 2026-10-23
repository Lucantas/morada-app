import { ACTIVITY_LABELS } from '../domain/activity';
import type { ActivityRepository } from '../domain/activity-repository';

export const ACTIVITY_LIMIT = 100;

export interface ActivityView {
  id: string;
  action: string;
  label: string;
  actorName: string;
  subjectId: string | null;
  at: string;
}

export async function listActivity(repo: ActivityRepository): Promise<ActivityView[]> {
  const entries = await repo.latest(ACTIVITY_LIMIT);
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    label: ACTIVITY_LABELS[entry.action],
    actorName: entry.actorName,
    subjectId: entry.subjectId,
    at: entry.at.toISOString(),
  }));
}
