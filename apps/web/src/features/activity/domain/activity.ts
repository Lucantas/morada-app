import { z } from 'zod';

export const activityEntrySchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  label: z.string().min(1),
  actorName: z.string(),
  subjectId: z.string().nullable(),
  at: z.string().datetime(),
});

export type ActivityEntry = z.infer<typeof activityEntrySchema>;

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
