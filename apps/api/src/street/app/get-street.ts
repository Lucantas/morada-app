import { listMyCondos, type CondoSummary } from '../../condos/app/condo-access-views';
import type { CondoRepository } from '../../condos/domain/condo-repository';
import { isStaff } from '../../condos/domain/permissions';
import type { User } from '../../users/domain/user';
import type { StreetFacts } from '../domain/street';
import type { StreetQuery } from '../domain/street-query';

export type StreetCondo = CondoSummary & StreetFacts;
export type Street = { name: string | null; condos: StreetCondo[]; homes: CondoSummary[] };

export async function getStreet(
  deps: {
    condos: Pick<CondoRepository, 'listForUser'>;
    users: { findById(id: string): Promise<Pick<User, 'name'> | null> };
    street: Pick<StreetQuery, 'factsFor'>;
  },
  userId: string,
  today: string,
): Promise<Street | null> {
  const user = await deps.users.findById(userId);
  if (!user) return null;
  const summaries = await listMyCondos(deps.condos, userId);
  const staff = summaries.filter((summary) => isStaff(summary.condoRole));
  const homes = summaries.filter((summary) => !isStaff(summary.condoRole));
  const facts = await deps.street.factsFor(
    staff.map((summary) => summary.id),
    userId,
    today,
  );
  const condos = staff.map((summary) => {
    const found = facts.get(summary.id);
    if (!found) throw new Error(`Street facts missing for condominium ${summary.id}`);
    return { ...summary, ...found };
  });
  return { name: user.name, condos, homes };
}
