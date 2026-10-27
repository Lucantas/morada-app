import type { CondoRepository } from '../../condos/domain/condo-repository';

export async function removeSindico(
  deps: { condos: Pick<CondoRepository, 'removeSindico'> },
  condominiumId: string,
): Promise<void> {
  await deps.condos.removeSindico(condominiumId);
}
