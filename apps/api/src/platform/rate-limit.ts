export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_MS = 15 * 60 * 1000;

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

export interface RateLimiter {
  check(key: string, now: number): { allowed: boolean };
  fail(key: string, now: number): void;
  succeed(key: string): void;
}

export function createRateLimiter(opts?: {
  maxAttempts?: number;
  windowMs?: number;
  lockoutMs?: number;
}): RateLimiter {
  const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const lockoutMs = opts?.lockoutMs ?? LOCKOUT_MS;
  const entries = new Map<string, RateLimitEntry>();

  return {
    check(key, now) {
      const entry = entries.get(key);
      if (!entry) return { allowed: true };
      return { allowed: entry.lockedUntil <= now };
    },

    fail(key, now) {
      const existing = entries.get(key);
      const stillLocked = existing !== undefined && existing.lockedUntil > now;
      const withinWindow =
        existing !== undefined && (stillLocked || now - existing.windowStart <= windowMs);
      const entry: RateLimitEntry = withinWindow
        ? { ...existing, count: existing.count + 1 }
        : { count: 1, windowStart: now, lockedUntil: 0 };

      entries.set(
        key,
        entry.count >= maxAttempts ? { ...entry, lockedUntil: now + lockoutMs } : entry,
      );
    },

    succeed(key) {
      entries.delete(key);
    },
  };
}
