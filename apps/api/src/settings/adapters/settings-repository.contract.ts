import type { SettingsRepository } from '../domain/settings-repository';

export function runSettingsRepositoryContract(
  label: string,
  makeRepo: () => Promise<SettingsRepository>,
): void {
  describe(label, () => {
    test('get returns the seeded default settings', async () => {
      const repo = await makeRepo();
      expect(await repo.get()).toEqual({ monthlyFeeCents: 15000, dueDay: 15 });
    });

    test('save then get round-trips the updated settings', async () => {
      const repo = await makeRepo();
      await repo.save({ monthlyFeeCents: 20000, dueDay: 10 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 20000, dueDay: 10 });
    });

    test('save keeps a single row (upsert, not insert)', async () => {
      const repo = await makeRepo();
      await repo.save({ monthlyFeeCents: 18000, dueDay: 5 });
      await repo.save({ monthlyFeeCents: 19000, dueDay: 8 });
      expect(await repo.get()).toEqual({ monthlyFeeCents: 19000, dueDay: 8 });
    });
  });
}
