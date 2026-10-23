import type { AuthTokenRepository } from '../domain/auth-token-repository';

export const CONTRACT_USER_ID = 'u-token';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const EARLIER = new Date(NOW.getTime() - 60_000);

export function runAuthTokenRepositoryContract(
  label: string,
  makeRepo: () => Promise<AuthTokenRepository>,
): void {
  describe(label, () => {
    test('consume returns the owner of a valid token', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'h1',
        expiresAt: LATER,
      });
      expect(await repo.consume('h1', 'confirm_email', NOW)).toEqual({ userId: CONTRACT_USER_ID });
    });

    test('a token can be consumed only once', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'h1',
        expiresAt: LATER,
      });
      await repo.consume('h1', 'confirm_email', NOW);
      expect(await repo.consume('h1', 'confirm_email', NOW)).toBeNull();
    });

    test('an expired token is not consumable', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'h1',
        expiresAt: EARLIER,
      });
      expect(await repo.consume('h1', 'confirm_email', NOW)).toBeNull();
    });

    test('an unknown hash is not consumable', async () => {
      const repo = await makeRepo();
      expect(await repo.consume('ghost', 'confirm_email', NOW)).toBeNull();
    });

    test('a token of another kind is not consumable', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'reset_password',
        tokenHash: 'h1',
        expiresAt: LATER,
      });
      expect(await repo.consume('h1', 'confirm_email', NOW)).toBeNull();
      expect(await repo.consume('h1', 'reset_password', NOW)).toEqual({
        userId: CONTRACT_USER_ID,
      });
    });

    test('peek returns the owner of a valid token without consuming it', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'h1',
        expiresAt: LATER,
      });

      expect(await repo.peek('h1', 'confirm_email', NOW)).toEqual({ userId: CONTRACT_USER_ID });
      expect(await repo.consume('h1', 'confirm_email', NOW)).toEqual({ userId: CONTRACT_USER_ID });
    });

    test('peek ignores used, expired, unknown and other-kind tokens', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'used',
        expiresAt: LATER,
      });
      await repo.consume('used', 'confirm_email', NOW);
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'old',
        expiresAt: EARLIER,
      });
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'reset_password',
        tokenHash: 'reset',
        expiresAt: LATER,
      });

      expect(await repo.peek('used', 'confirm_email', NOW)).toBeNull();
      expect(await repo.peek('old', 'confirm_email', NOW)).toBeNull();
      expect(await repo.peek('ghost', 'confirm_email', NOW)).toBeNull();
      expect(await repo.peek('reset', 'confirm_email', NOW)).toBeNull();
    });

    test('revokeAll invalidates unused tokens of that kind only', async () => {
      const repo = await makeRepo();
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'confirm_email',
        tokenHash: 'c1',
        expiresAt: LATER,
      });
      await repo.issue({
        userId: CONTRACT_USER_ID,
        kind: 'reset_password',
        tokenHash: 'r1',
        expiresAt: LATER,
      });
      await repo.revokeAll(CONTRACT_USER_ID, 'confirm_email', NOW);
      expect(await repo.consume('c1', 'confirm_email', NOW)).toBeNull();
      expect(await repo.consume('r1', 'reset_password', NOW)).toEqual({
        userId: CONTRACT_USER_ID,
      });
    });
  });
}
