import { normalizeEmail } from '../domain/email';
import { InvalidCredentialsError } from '../domain/errors';
import type { PasswordHasher } from '../domain/password-hasher';
import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

// A valid bcrypt hash compared against when the username is unknown, so login
// always pays the same hashing cost and cannot be used as a timing oracle to
// enumerate valid usernames.
const DUMMY_HASH = '$2a$12$Om6g2yPwZJROtEM84bqdNuynQ4xxjCuDX/9.UrhIQaInbBPDPDDtG';

function findByLogin(repo: UserRepository, login: string): Promise<User | null> {
  return login.includes('@') ? repo.findByEmail(normalizeEmail(login)) : repo.findByUsername(login);
}

export async function verifyCredentials(
  repo: UserRepository,
  hasher: PasswordHasher,
  login: string,
  password: string,
): Promise<User> {
  const user = await findByLogin(repo, login);
  const matches = await hasher.verify(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) throw new InvalidCredentialsError();
  return user;
}
