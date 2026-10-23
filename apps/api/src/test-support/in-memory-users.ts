import type { AuthTokenKind } from '../users/domain/auth-token';
import type { AuthTokenRepository, IssueAuthToken } from '../users/domain/auth-token-repository';
import type { User } from '../users/domain/user';
import type { UserRepository } from '../users/domain/user-repository';

export function inMemoryUsers(initial: User[] = []): UserRepository & { all: () => User[] } {
  let list = [...initial];
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
    setPasswordHash: async (id, passwordHash) => {
      list = list.map((u) => (u.id === id ? { ...u, passwordHash } : u));
    },
    updateCredentials: async (id, { name, passwordHash }) => {
      list = list.map((u) => (u.id === id ? { ...u, name, passwordHash } : u));
    },
    bumpSessionVersion: async (id) => {
      const found = list.find((u) => u.id === id);
      if (!found) throw new Error(`User not found: ${id}`);
      const sessionVersion = found.sessionVersion + 1;
      list = list.map((u) => (u.id === id ? { ...u, sessionVersion } : u));
      return sessionVersion;
    },
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
  return {
    issue: async (token) => {
      tokens = [...tokens, { ...token, usedAt: null }];
    },
    consume: async (tokenHash: string, kind: AuthTokenKind, now: Date) => {
      const found = tokens.find(
        (t) =>
          t.tokenHash === tokenHash &&
          t.kind === kind &&
          t.usedAt === null &&
          t.expiresAt.getTime() > now.getTime(),
      );
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
