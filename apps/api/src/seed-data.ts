import type { CondoRepository } from './condos/domain/condo-repository';
import { config } from './platform/config';
import type { PasswordHasher } from './users/domain/password-hasher';
import type { User } from './users/domain/user';
import type { UserRepository } from './users/domain/user-repository';

/**
 * The ONLY seeded login: the admin (síndico). Everything else — residents, their
 * logins, accounts, receipts, notices — is created through the app. Change this
 * before any real deployment; it is intentionally weak and public.
 */
export const adminCredentials = { username: 'admin', password: 'morada-admin' } as const;

const ADMIN_ID = 'u-admin';

const DEMO_CONDOMINIUM = {
  organizationName: 'Morada Demo',
  name: 'Condomínio Demo',
  monthlyFeeCents: 15000,
  dueDay: 15,
} as const;

// Seeds the admin login, through the repository. Idempotent: a no-op once the
// admin exists. In production, refuses to seed into an already-populated
// database instead of silently no-op'ing, to surface misconfiguration loudly.
async function ensureAdmin(users: UserRepository, hasher: PasswordHasher): Promise<void> {
  const adminExists = await users.existsByUsername(adminCredentials.username);
  if (adminExists) return;
  if (config.isProduction && (await users.hasAny())) {
    throw new Error('Refusing to seed demo admin into a populated production database');
  }
  const admin: User = {
    id: ADMIN_ID,
    username: adminCredentials.username,
    passwordHash: await hasher.hash(adminCredentials.password),
    role: 'admin',
    residentId: null,
    email: null,
    name: null,
    emailVerifiedAt: null,
    sessionVersion: 0,
  };
  await users.save(admin);
}

async function ensureAdminCondominium(condos: CondoRepository): Promise<void> {
  if ((await condos.listForUser(ADMIN_ID)).length > 0) return;
  const organization = await condos.createOrganization({
    name: DEMO_CONDOMINIUM.organizationName,
    ownerUserId: ADMIN_ID,
  });
  const condominium = await condos.create({
    organizationId: organization.id,
    name: DEMO_CONDOMINIUM.name,
    monthlyFeeCents: DEMO_CONDOMINIUM.monthlyFeeCents,
    dueDay: DEMO_CONDOMINIUM.dueDay,
  });
  await condos.grant({
    condominiumId: condominium.id,
    userId: ADMIN_ID,
    role: 'administrador',
    residentId: null,
  });
}

export async function seedAdmin(
  users: UserRepository,
  condos: CondoRepository,
  hasher: PasswordHasher,
): Promise<void> {
  await ensureAdmin(users, hasher);
  await ensureAdminCondominium(condos);
}
