import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { UsernameTakenError, UserValidationError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { usernameSchema, userSchema, type User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const inputSchema = z.object({
  username: usernameSchema,
  password: z.string().min(8).max(200),
  residentId: z.string().min(1).max(64),
});

export async function createResidentLogin(
  repo: UserRepository,
  hasher: PasswordHasher,
  input: unknown,
): Promise<User> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new UserValidationError('Dados de acesso inválidos');
  const { username, password, residentId } = parsed.data;

  if (repo.existsByUsername(username)) throw new UsernameTakenError(username);

  const user = userSchema.parse({
    id: randomUUID(),
    username,
    passwordHash: await hasher.hash(password),
    role: 'resident',
    residentId,
  });
  return repo.save(user);
}
