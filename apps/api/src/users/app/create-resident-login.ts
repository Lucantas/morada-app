import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { deriveResidentLogin } from '../../residents/domain/login';
import type { Resident } from '../../residents/domain/resident';
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
  password: z.string().min(8).max(200),
  residentId: z.string().min(1).max(64),
});

/** Loads the target resident (compose wires this to the resident repo) so the
 *  login can be derived from their name + apartment and never provisioned for a
 *  dangling or mistyped resident id. */
export type ResidentLookup = (residentId: string) => Promise<Resident | null>;

export async function createResidentLogin(
  repo: UserRepository,
  hasher: PasswordHasher,
  getResident: ResidentLookup,
  input: unknown,
): Promise<User> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new UserValidationError('Dados de acesso inválidos');
  const { password, residentId } = parsed.data;

  const resident = await getResident(residentId);
  if (!resident) throw new UnknownResidentError(residentId);

  const derivedUsername = deriveResidentLogin(resident.name, resident.apt);
  const username = usernameSchema.safeParse(derivedUsername);
  if (!username.success) {
    throw new UserValidationError(
      'Não foi possível gerar um acesso válido a partir do nome e apartamento',
    );
  }

  if (await repo.existsByUsername(username.data)) throw new UsernameTakenError(username.data);
  if (await repo.existsByResidentId(residentId)) throw new ResidentLoginExistsError(residentId);

  const user = userSchema.parse({
    id: randomUUID(),
    username: username.data,
    passwordHash: await hasher.hash(password),
    role: 'resident',
    residentId,
  });
  return repo.save(user);
}
