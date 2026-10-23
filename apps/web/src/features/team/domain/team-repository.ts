import type { CreatedInvitation } from '@/features/invitations/domain/invitation';
import type { OrgRole } from '@/shared/lib/permissions';

import type { Team } from './team';

export interface TeamRepository {
  get(): Promise<Team>;
  rename(name: string): Promise<void>;
  invite(email: string, orgRole: OrgRole, phone?: string): Promise<CreatedInvitation>;
  revokeInvitation(invitationId: string): Promise<void>;
  deactivateMember(userId: string): Promise<void>;
  assignCondos(userId: string, condoIds: readonly string[]): Promise<void>;
}
