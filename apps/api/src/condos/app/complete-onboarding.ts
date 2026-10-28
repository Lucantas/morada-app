import type { CondoRepository } from '../domain/condo-repository';

export async function completeOnboarding(
  condos: Pick<CondoRepository, 'completeOnboarding'>,
  condominiumId: string,
): Promise<void> {
  await condos.completeOnboarding(condominiumId);
}
