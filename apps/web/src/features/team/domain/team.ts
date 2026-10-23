import { z } from 'zod';

import { emailSchema, validate, type Validation } from '@/features/auth/domain/auth-schemas';
import { orgRoleSchema } from '@/shared/lib/permissions';

export const teamMemberSchema = z.object({
  userId: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: orgRoleSchema,
  active: z.boolean(),
  condoIds: z.array(z.string()),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamCondoSchema = z.object({ id: z.string().min(1), name: z.string() });
export type TeamCondo = z.infer<typeof teamCondoSchema>;

export const teamInvitationSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  orgRole: orgRoleSchema,
  expiresAt: z.string().datetime(),
});
export type TeamInvitation = z.infer<typeof teamInvitationSchema>;

export const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  members: z.array(teamMemberSchema),
  condos: z.array(teamCondoSchema),
  invitations: z.array(teamInvitationSchema),
});
export type Team = z.infer<typeof teamSchema>;

export const TEAM_EMAIL_REQUIRED = 'Informe o e-mail da pessoa';

export function validateTeamEmail(email: string): Validation<string> {
  if (email.trim() === '') return { ok: false, message: TEAM_EMAIL_REQUIRED };
  return validate(emailSchema, email);
}

export function memberLabel(member: TeamMember): string {
  return member.name ?? member.email ?? 'Sem nome';
}

export function toggleCondo(
  condos: readonly TeamCondo[],
  current: readonly string[],
  condoId: string,
): string[] {
  const next = new Set(current);
  if (next.has(condoId)) next.delete(condoId);
  else next.add(condoId);
  return condos.map((condo) => condo.id).filter((id) => next.has(id));
}
