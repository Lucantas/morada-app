import { z } from 'zod';

import { ResidentValidationError } from '../domain/errors';
import { residentStatusSchema } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

const inputSchema = z.object({ status: residentStatusSchema.nullable() });

export async function overrideStatus(
  repo: ResidentRepository,
  id: string,
  input: unknown,
): Promise<void> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new ResidentValidationError('Status inválido');
  await repo.setStatusOverride(id, parsed.data.status);
}
