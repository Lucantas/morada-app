import type { UserRepository } from '../domain/user-repository';

export function sessionVersionOf(
  users: Pick<UserRepository, 'findById'>,
): (userId: string) => Promise<number | null> {
  return async (userId) => (await users.findById(userId))?.sessionVersion ?? null;
}
