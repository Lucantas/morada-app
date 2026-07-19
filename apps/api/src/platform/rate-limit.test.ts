import { createRateLimiter, LOCKOUT_MS, MAX_ATTEMPTS, WINDOW_MS } from './rate-limit';

describe('createRateLimiter', () => {
  test('allows attempts under the max', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      limiter.fail('ip:user', now);
    }

    expect(limiter.check('ip:user', now)).toEqual({ allowed: true });
  });

  test('locks the key after reaching the max attempts', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.fail('ip:user', now);
    }

    expect(limiter.check('ip:user', now)).toEqual({ allowed: false });
  });

  test('succeed clears a locked key', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.fail('ip:user', now);
    }
    limiter.succeed('ip:user');

    expect(limiter.check('ip:user', now)).toEqual({ allowed: true });
  });

  test('unlocks after LOCKOUT_MS elapses', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.fail('ip:user', now);
    }

    expect(limiter.check('ip:user', now + LOCKOUT_MS + 1)).toEqual({ allowed: true });
  });

  test('keys are independent', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      limiter.fail('ip:userA', now);
    }

    expect(limiter.check('ip:userA', now)).toEqual({ allowed: false });
    expect(limiter.check('ip:userB', now)).toEqual({ allowed: true });
  });

  test('resets the attempt count once the window has elapsed', () => {
    const limiter = createRateLimiter();
    const now = 0;

    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      limiter.fail('ip:user', now);
    }

    const laterNow = now + 20 * 60 * 1000;
    limiter.fail('ip:user', laterNow);

    expect(limiter.check('ip:user', laterNow)).toEqual({ allowed: true });
  });

  test('keeps the lock in force when a fail arrives after the window but before the lockout expires', () => {
    const limiter = createRateLimiter();

    limiter.fail('ip:user', 0);
    limiter.fail('ip:user', 1);
    limiter.fail('ip:user', 2);
    limiter.fail('ip:user', 3);
    limiter.fail('ip:user', WINDOW_MS - 1);

    expect(limiter.check('ip:user', WINDOW_MS)).toEqual({ allowed: false });

    limiter.fail('ip:user', WINDOW_MS + 1);

    expect(limiter.check('ip:user', WINDOW_MS + 2)).toEqual({ allowed: false });
  });

  test('unlocks once LOCKOUT_MS has elapsed even after a mid-lockout fail', () => {
    const limiter = createRateLimiter();

    limiter.fail('ip:user', 0);
    limiter.fail('ip:user', 1);
    limiter.fail('ip:user', 2);
    limiter.fail('ip:user', 3);
    limiter.fail('ip:user', WINDOW_MS - 1);
    limiter.fail('ip:user', WINDOW_MS + 1);

    const unlockAt = WINDOW_MS + 1 + LOCKOUT_MS + 1;
    expect(limiter.check('ip:user', unlockAt)).toEqual({ allowed: true });
  });

  test('respects custom options', () => {
    const limiter = createRateLimiter({ maxAttempts: 2, windowMs: 1000, lockoutMs: 500 });
    const now = 0;

    limiter.fail('ip:user', now);
    limiter.fail('ip:user', now);

    expect(limiter.check('ip:user', now)).toEqual({ allowed: false });
    expect(limiter.check('ip:user', now + 501)).toEqual({ allowed: true });
  });
});
