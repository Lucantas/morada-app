import { z } from 'zod';

import {
  emailSchema,
  newPasswordSchema,
  passwordSchema,
  personNameSchema,
  validate,
  type Validation,
} from '@/features/auth/domain/auth-schemas';

export const invitationStatusSchema = z.enum(['pendente', 'aceito', 'expirado', 'revogado']);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const invitationViewSchema = z.object({
  status: invitationStatusSchema,
  email: z.string().nullable(),
  expiresAt: z.string().datetime(),
});
export type InvitationView = z.infer<typeof invitationViewSchema>;

export const createdInvitationSchema = invitationViewSchema.extend({
  link: z.string().url(),
  whatsappUrl: z.string().url(),
  emailSent: z.boolean(),
});
export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const invitationPreviewSchema = z.object({
  condoName: z.string(),
  residentName: z.string(),
  apt: z.string(),
  email: z.string().nullable(),
  accountExists: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const legacyLoginSchema = z.object({ username: z.string().nullable() });

export const legacyLoginResetSchema = z.object({
  username: z.string(),
  tempPassword: z.string(),
});
export type LegacyLoginReset = z.infer<typeof legacyLoginResetSchema>;

export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function validateInviteEmail(email: string): Validation<string> {
  if (email.trim() === '') return { ok: true, data: '' };
  return validate(emailSchema, email);
}

export type AcceptMode = 'open' | 'existing-account' | 'new-account';

export function acceptMode(preview: InvitationPreview): AcceptMode {
  if (preview.email === null) return 'open';
  return preview.accountExists ? 'existing-account' : 'new-account';
}

export type AcceptForm = { email: string; name: string; password: string; confirmation: string };

export type AcceptInput = { email?: string; name?: string; password: string };

const openAcceptSchema = z.object({
  email: emailSchema,
  name: personNameSchema,
  password: passwordSchema,
});

const existingAccountSchema = z.object({
  password: z.string().min(1, 'Informe sua senha.').max(200, 'Use até 200 caracteres.'),
});

const newAccountSchema = z
  .object({ name: personNameSchema })
  .and(newPasswordSchema)
  .transform(({ name, password }) => ({ name, password }));

export function buildAcceptInput(mode: AcceptMode, form: AcceptForm): Validation<AcceptInput> {
  if (mode === 'open') return validate(openAcceptSchema, form);
  if (mode === 'existing-account') return validate(existingAccountSchema, form);
  return validate(newAccountSchema, form);
}
