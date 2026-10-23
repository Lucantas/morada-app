import { z } from 'zod';

import { isEmailVerified, type User } from '../../users/domain/user';
import { condominiumSchema } from '../domain/condominium';
import type { CondoRepository } from '../domain/condo-repository';
import { CondoValidationError, EmailNotConfirmedError } from '../domain/errors';
import { summaryOf, type CondoSummary } from './condo-access-views';

const DEFAULT_MONTHLY_FEE_CENTS = 0;
const DEFAULT_DUE_DAY = 10;

const inputSchema = z.object({ name: condominiumSchema.shape.name });

export async function createMyCondominium(
  condos: Pick<CondoRepository, 'ownedOrganization' | 'createOrganization' | 'create' | 'grant'>,
  user: User,
  input: unknown,
): Promise<CondoSummary> {
  if (!isEmailVerified(user)) throw new EmailNotConfirmedError();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new CondoValidationError();
  const { name } = parsed.data;
  const organization =
    (await condos.ownedOrganization(user.id)) ??
    (await condos.createOrganization({ name, ownerUserId: user.id }));
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
      orgRole: 'owner',
    },
    'admin',
  );
}
