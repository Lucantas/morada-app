import type { LoginResponse } from '@/features/session/domain/login-response';

import type {
  AcceptInput,
  CreatedInvitation,
  InvitationPreview,
  InvitationView,
  LegacyLoginReset,
  SindicoView,
} from './invitation';

export interface InvitationRepository {
  invitation(residentId: string): Promise<InvitationView | null>;
  invite(residentId: string, email: string): Promise<CreatedInvitation>;
  revoke(residentId: string): Promise<void>;
  legacyLogin(residentId: string): Promise<string | null>;
  resetLegacyLogin(residentId: string): Promise<LegacyLoginReset>;
  sindico(): Promise<SindicoView>;
  inviteSindico(email: string, phone?: string): Promise<CreatedInvitation>;
  revokeSindico(): Promise<void>;
  removeSindico(): Promise<void>;
  preview(token: string): Promise<InvitationPreview>;
  accept(token: string, input: AcceptInput): Promise<LoginResponse>;
}
