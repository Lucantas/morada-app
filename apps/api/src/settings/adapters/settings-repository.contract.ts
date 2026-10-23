import { SettingsNotFoundError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

export function runSettingsRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<SettingsRepository>,
): void {
  describe(label, () => {
    test('get returns the seeded default settings', async () => {
      const repo = await makeRepo('condo-a');
      expect(await repo.get()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
    });

    test('save then get round-trips the updated settings', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save({ monthlyFeeCents: 20000, dueDay: 10 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
    });

    test('save keeps a single row (upsert, not insert)', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save({ monthlyFeeCents: 18000, dueDay: 5 });
      await repo.save({ monthlyFeeCents: 19000, dueDay: 8 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 19000, dueDay: 8 });
    });

    test('get for a condo without settings throws SettingsNotFoundError', async () => {
      const repo = await makeRepo('condo-missing');
      await expect(repo.get()).rejects.toBeInstanceOf(SettingsNotFoundError);
    });

    test('save for a condo without settings throws SettingsNotFoundError', async () => {
      const repo = await makeRepo('condo-missing');
      await expect(repo.save({ monthlyFeeCents: 1, dueDay: 1 })).rejects.toBeInstanceOf(
        SettingsNotFoundError,
      );
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');

      await repoA.save({ monthlyFeeCents: 22000, dueDay: 7 });

      expect(await repoB.get()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
      await repoB.save({ monthlyFeeCents: 30000, dueDay: 20 });
      expect(await repoA.get()).toEqual({ monthlyFeeCents: 22000, dueDay: 7 });
    });
  });
}
