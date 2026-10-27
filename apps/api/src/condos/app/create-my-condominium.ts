import { z } from 'zod';

import { isEmailVerified, type User } from '../../users/domain/user';
import type { OrgRoleName } from '../domain/condo-access';
import { condominiumSchema } from '../domain/condominium';
import type { CondoRepository } from '../domain/condo-repository';
import { CondoValidationError, EmailNotConfirmedError } from '../domain/errors';
import { summaryOf, type CondoSummary } from './condo-access-views';

const DEFAULT_MONTHLY_FEE_CENTS = 0;
const DEFAULT_DUE_DAY = 10;

const inputSchema = z.object({ name: condominiumSchema.shape.name });

async function targetOrganization(
  condos: Pick<CondoRepository, 'ownedOrganization' | 'memberOrganization' | 'createOrganization'>,
  userId: string,
  name: string,
): Promise<{ organization: { id: string }; orgRole: OrgRoleName }> {
  const owned = await condos.ownedOrganization(userId);
  if (owned) return { organization: owned, orgRole: 'owner' };
  const membership = await condos.memberOrganization(userId);
  if (membership) return { organization: membership, orgRole: 'member' };
  return {
    organization: await condos.createOrganization({ name, ownerUserId: userId }),
    orgRole: 'owner',
  };
}

export async function createMyCondominium(
  condos: Pick<
    CondoRepository,
    'ownedOrganization' | 'memberOrganization' | 'createOrganization' | 'create' | 'grant'
  >,
  user: User,
  input: unknown,
): Promise<CondoSummary> {
  if (!isEmailVerified(user)) throw new EmailNotConfirmedError();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new CondoValidationError();
  const { name } = parsed.data;
  const { organization, orgRole } = await targetOrganization(condos, user.id, name);
  const condo = await condos.create({
    organizationId: organization.id,
    name,
    monthlyFeeCents: DEFAULT_MONTHLY_FEE_CENTS,
    dueDay: DEFAULT_DUE_DAY,
  });
  await condos.grant({
    condominiumId: condo.id,
    userId: user.id,
    role: 'administrador',
    residentId: null,
  });
  return summaryOf(
    {
      condominiumId: condo.id,
      name: condo.name,
      role: 'administrador',
      residentId: null,
      organizationId: organization.id,
      orgRole,
    },
    'admin',
  );
}
