import { z } from 'zod';

export const authTokenKindSchema = z.enum(['confirm_email', 'reset_password']);
export type AuthTokenKind = z.infer<typeof authTokenKindSchema>;

export const CONFIRM_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;
