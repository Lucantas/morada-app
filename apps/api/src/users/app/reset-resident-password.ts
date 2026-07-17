import { z } from 'zod';

import { ResidentLoginNotFoundError, UserValidationError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { userSchema, type User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const passwordSchema = z.string().min(8).max(200);

export async function resetResidentPassword(
  repo: UserRepository,
  hasher: PasswordHasher,
  residentId: string,
  newPassword: unknown,
): Promise<User> {
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) throw new UserValidationError('Senha inválida');

  const existing = await repo.findByResidentId(residentId);
  if (existing === null) throw new ResidentLoginNotFoundError(residentId);

  const user = userSchema.parse({
    ...existing,
    passwordHash: await hasher.hash(parsed.data),
  });
  return repo.save(user);
}
