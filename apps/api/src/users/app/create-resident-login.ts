import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  ResidentLoginExistsError,
  UnknownResidentError,
  UsernameTakenError,
  UserValidationError,
} from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { usernameSchema, userSchema, type User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const inputSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(200),
  residentId: z.string().min(1).max(64),
});

/** Confirms the target resident exists (compose wires this to the resident repo)
 *  so a login can't be provisioned for a dangling or mistyped resident id. */
export type ResidentGuard = (residentId: string) => boolean;

export async function createResidentLogin(
  repo: UserRepository,
  hasher: PasswordHasher,
  residentExists: ResidentGuard,
  input: unknown,
): Promise<User> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new UserValidationError('Dados de acesso inválidos');
  const { username, password, residentId } = parsed.data;

  if (!residentExists(residentId)) throw new UnknownResidentError(residentId);
  if (repo.existsByUsername(username)) throw new UsernameTakenError(username);
  if (repo.existsByResidentId(residentId)) throw new ResidentLoginExistsError(residentId);

  const user = userSchema.parse({
    id: randomUUID(),
    username,
    passwordHash: await hasher.hash(password),
    role: 'resident',
    residentId,
  });
  return repo.save(user);
}
