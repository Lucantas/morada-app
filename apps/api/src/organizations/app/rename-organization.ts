import { z } from 'zod';

import { organizationNameSchema, type Organization } from '../domain/organization';
import type { OrganizationRepository } from '../domain/organization-repository';

const renameBodySchema = z.object({ name: organizationNameSchema });

export async function renameOrganization(
  organizations: Pick<OrganizationRepository, 'rename'>,
  organizationId: string,
  input: unknown,
): Promise<Organization> {
  const { name } = renameBodySchema.parse(input);
  return organizations.rename(organizationId, name);
}
