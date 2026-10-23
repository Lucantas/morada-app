import { condominiumSchema } from '../domain/condominium';
import type { CondoRepository } from '../domain/condo-repository';
import { CondoNotFoundError, CondoValidationError } from '../domain/errors';

export type CondoInfo = { id: string; name: string };

export async function getCondoInfo(
  condos: Pick<CondoRepository, 'getById'>,
  condoId: string,
): Promise<CondoInfo> {
  const condo = await condos.getById(condoId);
  if (!condo) throw new CondoNotFoundError();
  return { id: condo.id, name: condo.name };
}

export async function renameCondo(
  condos: Pick<CondoRepository, 'rename'>,
  condoId: string,
  input: unknown,
): Promise<CondoInfo> {
  const parsed = condominiumSchema.shape.name.safeParse(
    typeof input === 'object' && input !== null ? (input as { name?: unknown }).name : undefined,
  );
  if (!parsed.success) throw new CondoValidationError();
  const condo = await condos.rename(condoId, parsed.data);
  return { id: condo.id, name: condo.name };
}
