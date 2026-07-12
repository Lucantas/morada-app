import { InvalidCredentialsError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

export async function verifyCredentials(
  repo: UserRepository,
  hasher: PasswordHasher,
  username: string,
  password: string,
): Promise<User> {
  const user = repo.findByUsername(username);
  if (!user) throw new InvalidCredentialsError();
  const matches = await hasher.verify(password, user.passwordHash);
  if (!matches) throw new InvalidCredentialsError();
  return user;
}
