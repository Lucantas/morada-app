import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { EmailUnavailableError, type EmailSender } from '../../platform/email/email-sender';
import { issueConfirmation } from '../../users/app/issue-confirmation';
import type { AuthTokenRepository } from '../../users/domain/auth-token-repository';
import { emailSchema } from '../../users/domain/email';
import { EmailTakenError, InvalidCredentialsError } from '../../users/domain/errors';
import type { PasswordHasher } from '../../users/domain/password-hasher';
import type { User } from '../../users/domain/user';
import type { UserRepository } from '../../users/domain/user-repository';
import { InvalidInvitationError } from '../domain/errors';
import type { Invitation } from '../domain/invitation';

import { grantInvitation, type GrantInvitationDeps } from './activate-claimed-invitations';
import { findUsableInvitation, type UsableInvitationDeps } from './usable-invitation';

const acceptBodySchema = z.object({
  email: z.string().max(160).optional(),
  password: z.string().min(1).max(200),
  name: z.string().max(120).optional(),
});
type AcceptBody = z.infer<typeof acceptBodySchema>;

const newAccountSchema = z.object({
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120),
});

export interface AcceptInvitationDeps extends UsableInvitationDeps, GrantInvitationDeps {
  condos: UsableInvitationDeps['condos'] & GrantInvitationDeps['condos'];
  users: UserRepository;
  hasher: PasswordHasher;
  tokens: AuthTokenRepository;
  email: EmailSender;
  appUrl: string;
  activateClaimed: (userId: string) => Promise<void>;
}

async function claimFor(
  deps: AcceptInvitationDeps,
  invitation: Invitation,
  userId: string,
): Promise<void> {
  if (invitation.claimedBy === userId) return;
  if (!(await deps.invitations.claim(invitation.id, userId))) throw new InvalidInvitationError();
}

async function grantOrFail(
  deps: AcceptInvitationDeps,
  invitation: Invitation,
  userId: string,
): Promise<void> {
  if (!(await grantInvitation(deps, invitation, userId, deps.now()))) {
    throw new InvalidInvitationError();
  }
}

async function sendConfirmation(deps: AcceptInvitationDeps, user: { id: string; email: string }) {
  await deps.tokens.revokeAll(user.id, 'confirm_email', deps.now());
  await issueConfirmation(deps, user);
}

function ensureConfirmationSendable(deps: AcceptInvitationDeps): void {
  if (!deps.email.isAvailable()) throw new EmailUnavailableError();
}

async function verifyByInvitation(deps: AcceptInvitationDeps, user: User): Promise<User> {
  const now = deps.now();
  const sessionVersion = await deps.users.markEmailVerifiedAndBump(user.id, now, user.passwordHash);
  if (sessionVersion === null) throw new InvalidCredentialsError();
  return { ...user, emailVerifiedAt: now, sessionVersion };
}

async function acceptAsExisting(
  deps: AcceptInvitationDeps,
  invitation: Invitation,
  user: User & { email: string },
  password: string,
): Promise<User> {
  if (!(await deps.hasher.verify(password, user.passwordHash))) {
    throw new InvalidCredentialsError();
  }
  if (user.emailVerifiedAt === null && invitation.email === null) {
    ensureConfirmationSendable(deps);
  }
  await claimFor(deps, invitation, user.id);

  if (user.emailVerifiedAt !== null) {
    await grantOrFail(deps, invitation, user.id);
    return user;
  }
  if (invitation.email !== null) {
    const verified = await verifyByInvitation(deps, user);
    await grantOrFail(deps, invitation, user.id);
    await deps.activateClaimed(user.id);
    return verified;
  }
  await sendConfirmation(deps, user);
  return user;
}

async function createAccount(deps: AcceptInvitationDeps, user: User): Promise<void> {
  try {
    await deps.users.save(user);
  } catch (error) {
    if (error instanceof EmailTakenError) throw new InvalidCredentialsError();
    throw error;
  }
}

async function acceptAsNew(
  deps: AcceptInvitationDeps,
  invitation: Invitation,
  email: string,
  body: AcceptBody,
): Promise<User> {
  if (invitation.claimedBy !== null) throw new InvalidInvitationError();
  const { password, name } = newAccountSchema.parse(body);
  if (invitation.email === null) ensureConfirmationSendable(deps);
  const now = deps.now();
  const user: User = {
    id: randomUUID(),
    username: null,
    email,
    name,
    passwordHash: await deps.hasher.hash(password),
    role: 'resident',
    residentId: null,
    emailVerifiedAt: invitation.email === null ? null : now,
    sessionVersion: 0,
  };
  await createAccount(deps, user);
  await claimFor(deps, invitation, user.id);

  if (invitation.email === null) {
    await issueConfirmation(deps, { id: user.id, email });
  } else {
    await grantOrFail(deps, invitation, user.id);
  }
  return user;
}

export async function acceptInvitation(
  deps: AcceptInvitationDeps,
  token: string,
  input: unknown,
): Promise<User> {
  const body = acceptBodySchema.parse(input);
  const { invitation } = await findUsableInvitation(deps, token);
  if (invitation.email === null) newAccountSchema.parse(body);
  const email = invitation.email ?? emailSchema.parse(body.email);
  const existing = await deps.users.findByEmail(email);
  return existing
    ? acceptAsExisting(deps, invitation, { ...existing, email }, body.password)
    : acceptAsNew(deps, invitation, email, body);
}
