import type { User } from '../domain/user';
import { EmailTakenError } from '../domain/errors';
import type { UserRepository } from '../domain/user-repository';

const maria: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'hash-a',
  role: 'resident',
  residentId: 'r-1',
  email: null,
  name: null,
  emailVerifiedAt: null,
  sessionVersion: 0,
};

// Behavioural contract every UserRepository must satisfy, run against both the
// SQLite and Postgres adapters so the two stores stay in lockstep.
export function runUserRepositoryContract(
  label: string,
  makeRepo: () => Promise<UserRepository>,
): void {
  describe(label, () => {
    test('save then findByUsername round-trips', async () => {
      const repo = await makeRepo();
      await repo.save(maria);
      expect(await repo.findByUsername('maria302')).toEqual(maria);
    });

    test('findByUsername returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.findByUsername('ghost')).toBeNull();
    });

    test('save then findByResidentId round-trips', async () => {
      const repo = await makeRepo();
      await repo.save(maria);
      expect(await repo.findByResidentId('r-1')).toEqual(maria);
    });

    test('findByResidentId returns null when the resident has no login', async () => {
      const repo = await makeRepo();
      expect(await repo.findByResidentId('r-1')).toBeNull();
    });

    test('existsByUsername reflects saved users', async () => {
      const repo = await makeRepo();
      expect(await repo.existsByUsername('maria302')).toBe(false);
      await repo.save(maria);
      expect(await repo.existsByUsername('maria302')).toBe(true);
    });

    test('existsByResidentId reflects the linked resident', async () => {
      const repo = await makeRepo();
      expect(await repo.existsByResidentId('r-1')).toBe(false);
      await repo.save(maria);
      expect(await repo.existsByResidentId('r-1')).toBe(true);
      expect(await repo.existsByResidentId('r-2')).toBe(false);
    });

    test('hasAny reflects whether the store is populated', async () => {
      const repo = await makeRepo();
      expect(await repo.hasAny()).toBe(false);
      await repo.save(maria);
      expect(await repo.hasAny()).toBe(true);
    });

    test('rejects a second login for the same resident (unique index)', async () => {
      const repo = await makeRepo();
      await repo.save(maria);
      await expect(
        repo.save({
          id: 'u-2',
          username: 'maria302-alt',
          passwordHash: 'hash-c',
          role: 'resident',
          residentId: 'r-1',
          email: null,
          name: null,
          emailVerifiedAt: null,
          sessionVersion: 0,
        }),
      ).rejects.toThrow();
    });

    test('save persists an admin with a null residentId', async () => {
      const repo = await makeRepo();
      const admin: User = {
        id: 'u-admin',
        username: 'admin',
        passwordHash: 'hash-b',
        role: 'admin',
        residentId: null,
        email: null,
        name: null,
        emailVerifiedAt: null,
        sessionVersion: 0,
      };
      await repo.save(admin);
      expect(await repo.findByUsername('admin')).toEqual(admin);
    });

    test('save upserts on conflicting id (password rotation)', async () => {
      const repo = await makeRepo();
      await repo.save(maria);
      await repo.save({ ...maria, passwordHash: 'hash-rotated' });
      expect((await repo.findByUsername('maria302'))?.passwordHash).toBe('hash-rotated');
    });

    const ana: User = {
      id: 'u-ana',
      username: null,
      email: 'ana@x.com',
      name: 'Ana',
      passwordHash: 'hash-ana',
      role: 'resident',
      residentId: null,
      emailVerifiedAt: null,
      sessionVersion: 0,
    };

    test('findByEmail returns the user saved with that e-mail', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      expect(await repo.findByEmail('ana@x.com')).toEqual(ana);
      expect(await repo.findByEmail('ghost@x.com')).toBeNull();
    });

    test('findById returns the saved user', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      expect(await repo.findById('u-ana')).toEqual(ana);
      expect(await repo.findById('u-ghost')).toBeNull();
    });

    test('existsByEmail reflects saved users', async () => {
      const repo = await makeRepo();
      expect(await repo.existsByEmail('ana@x.com')).toBe(false);
      await repo.save(ana);
      expect(await repo.existsByEmail('ana@x.com')).toBe(true);
    });

    test('markEmailVerified sets emailVerifiedAt', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      const at = new Date('2026-10-23T12:00:00.000Z');
      await repo.markEmailVerified('u-ana', at);
      expect((await repo.findById('u-ana'))?.emailVerifiedAt).toEqual(at);
    });

    test('setPasswordHashAndBump replaces the hash and bumps the version in one step', async () => {
      const repo = await makeRepo();
      await repo.save(ana);

      expect(await repo.setPasswordHashAndBump('u-ana', 'hash-new')).toBe(1);
      expect(await repo.setPasswordHashAndBump('u-ana', 'hash-newer')).toBe(2);
      expect(await repo.findById('u-ana')).toEqual({
        ...ana,
        passwordHash: 'hash-newer',
        sessionVersion: 2,
      });
    });

    test('updateCredentialsAndBump replaces name and hash and bumps the version', async () => {
      const repo = await makeRepo();
      await repo.save(ana);

      const version = await repo.updateCredentialsAndBump('u-ana', {
        name: 'Outra',
        passwordHash: 'hash-other',
      });

      expect(version).toBe(1);
      expect(await repo.findById('u-ana')).toEqual({
        ...ana,
        name: 'Outra',
        passwordHash: 'hash-other',
        sessionVersion: 1,
      });
    });

    test('markEmailVerifiedAndBump verifies and bumps when the hash still matches', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      const at = new Date('2026-10-23T12:00:00.000Z');

      expect(await repo.markEmailVerifiedAndBump('u-ana', at, 'hash-ana')).toBe(1);
      expect(await repo.findById('u-ana')).toEqual({
        ...ana,
        emailVerifiedAt: at,
        sessionVersion: 1,
      });
    });

    test('markEmailVerifiedAndBump changes nothing when the hash was replaced', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      await repo.setPasswordHashAndBump('u-ana', 'hash-intruder');

      const result = await repo.markEmailVerifiedAndBump('u-ana', new Date(), 'hash-ana');

      expect(result).toBeNull();
      expect(await repo.findById('u-ana')).toEqual({
        ...ana,
        passwordHash: 'hash-intruder',
        sessionVersion: 1,
      });
    });

    test('the atomic updates reject or skip an unknown user', async () => {
      const repo = await makeRepo();

      await expect(repo.setPasswordHashAndBump('u-ghost', 'h')).rejects.toThrow();
      await expect(
        repo.updateCredentialsAndBump('u-ghost', { name: 'X', passwordHash: 'h' }),
      ).rejects.toThrow();
      expect(await repo.markEmailVerifiedAndBump('u-ghost', new Date(), 'h')).toBeNull();
    });

    test('sessionVersionOf reads the stored version, or null for an unknown user', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      await repo.setPasswordHashAndBump('u-ana', 'hash-new');

      expect(await repo.sessionVersionOf('u-ana')).toBe(1);
      expect(await repo.sessionVersionOf('u-ghost')).toBeNull();
    });

    test('save never rolls back the session version', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      await repo.setPasswordHashAndBump('u-ana', 'hash-ana');

      await repo.save({ ...ana, passwordHash: 'hash-rotated' });

      expect(await repo.findById('u-ana')).toEqual({
        ...ana,
        passwordHash: 'hash-rotated',
        sessionVersion: 1,
      });
    });

    test('rejects a second user with the same e-mail', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      await expect(repo.save({ ...ana, id: 'u-ana-2' })).rejects.toBeInstanceOf(EmailTakenError);
    });

    test('a user with a null username round-trips', async () => {
      const repo = await makeRepo();
      await repo.save(ana);
      expect((await repo.findById('u-ana'))?.username).toBeNull();
    });
  });
}
