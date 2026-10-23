import { z } from 'zod';

import { OrgMemberNotFoundError, OwnerCondosError } from '../domain/errors';
import { condoIdsSchema } from '../domain/organization';
import type { OrganizationRepository } from '../domain/organization-repository';

const assignBodySchema = z.object({ condoIds: condoIdsSchema });

export async function assignCondos(
  organizations: Pick<OrganizationRepository, 'member' | 'assignCondos'>,
  organizationId: string,
  userId: string,
  input: unknown,
): Promise<{ condoIds: string[] }> {
  const { condoIds } = assignBodySchema.parse(input);
  const membership = await organizations.member(organizationId, userId);
  if (!membership) throw new OrgMemberNotFoundError();
  if (membership.role === 'owner') throw new OwnerCondosError();
  return { condoIds: await organizations.assignCondos(organizationId, userId, condoIds) };
}
