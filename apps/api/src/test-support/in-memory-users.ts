import type { AuthTokenKind } from '../users/domain/auth-token';
import type { AuthTokenRepository, IssueAuthToken } from '../users/domain/auth-token-repository';
import type { User } from '../users/domain/user';
import type { UserRepository } from '../users/domain/user-repository';

export function inMemoryUsers(initial: User[] = []): UserRepository & { all: () => User[] } {
  let list = [...initial];
  const existing = (id: string): User => {
    const found = list.find((u) => u.id === id);
    if (!found) throw new Error(`User not found: ${id}`);
    return found;
  };
  const replace = (user: User): number => {
    list = list.map((u) => (u.id === user.id ? user : u));
    return user.sessionVersion;
  };
  return {
    all: () => list,
    findById: async (id) => list.find((u) => u.id === id) ?? null,
    findByEmail: async (email) => list.find((u) => u.email === email) ?? null,
    findByUsername: async (username) => list.find((u) => u.username === username) ?? null,
    findByResidentId: async (residentId) => list.find((u) => u.residentId === residentId) ?? null,
    existsByEmail: async (email) => list.some((u) => u.email === email),
    existsByUsername: async (username) => list.some((u) => u.username === username),
    existsByResidentId: async (residentId) => list.some((u) => u.residentId === residentId),
    hasAny: async () => list.length > 0,
    markEmailVerified: async (id, at) => {
      list = list.map((u) => (u.id === id ? { ...u, emailVerifiedAt: at } : u));
    },
    markEmailVerifiedAndBump: async (id, at, expectedPasswordHash) => {
      const found = list.find((u) => u.id === id && u.passwordHash === expectedPasswordHash);
      if (!found) return null;
      return replace({ ...found, emailVerifiedAt: at, sessionVersion: found.sessionVersion + 1 });
    },
    setPasswordHashAndBump: async (id, passwordHash) =>
      replace({ ...existing(id), passwordHash, sessionVersion: existing(id).sessionVersion + 1 }),
    updateCredentialsAndBump: async (id, { name, passwordHash }) =>
      replace({
        ...existing(id),
        name,
        passwordHash,
        sessionVersion: existing(id).sessionVersion + 1,
      }),
    sessionVersionOf: async (id) => list.find((u) => u.id === id)?.sessionVersion ?? null,
    save: async (user) => {
      list = [...list.filter((existing) => existing.id !== user.id), user];
      return user;
    },
  };
}

interface StoredToken extends IssueAuthToken {
  usedAt: Date | null;
}

export function inMemoryAuthTokens(): AuthTokenRepository {
  let tokens: StoredToken[] = [];
  const usable = (tokenHash: string, kind: AuthTokenKind, now: Date) =>
    tokens.find(
      (t) =>
        t.tokenHash === tokenHash &&
        t.kind === kind &&
        t.usedAt === null &&
        t.expiresAt.getTime() > now.getTime(),
    );
  return {
    issue: async (token) => {
      tokens = [...tokens, { ...token, usedAt: null }];
    },
    peek: async (tokenHash: string, kind: AuthTokenKind, now: Date) => {
      const found = usable(tokenHash, kind, now);
      return found ? { userId: found.userId } : null;
    },
    consume: async (tokenHash: string, kind: AuthTokenKind, now: Date) => {
      const found = usable(tokenHash, kind, now);
      if (!found) return null;
      tokens = tokens.map((t) => (t === found ? { ...t, usedAt: now } : t));
      return { userId: found.userId };
    },
    revokeAll: async (userId, kind, now) => {
      tokens = tokens.map((t) =>
        t.userId === userId && t.kind === kind && t.usedAt === null ? { ...t, usedAt: now } : t,
      );
    },
  };
}
