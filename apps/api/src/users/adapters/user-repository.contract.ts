import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

const maria: User = {
  id: 'u-1',
  username: 'maria302',
  passwordHash: 'hash-a',
  role: 'resident',
  residentId: 'r-1',
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
  });
}
