import { EmailTakenError, UnknownUserError, UserValidationError } from '../domain/errors';
import { emailSchema } from '../domain/email';
import type { UserRepository } from '../domain/user-repository';

export async function setUserEmail(
  users: UserRepository,
  username: string,
  email: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw new UserValidationError('E-mail inválido');

  const user = await users.findByUsername(username);
  if (!user) throw new UnknownUserError(username);

  const owner = await users.findByEmail(parsed.data);
  if (owner && owner.id !== user.id) throw new EmailTakenError(parsed.data);

  await users.save({ ...user, email: parsed.data, emailVerifiedAt: now() });
}
