import { CategoryValidationError } from '../domain/errors';
import { saveCategories, type AccountsForReclassify } from './save-categories';

function fakeRepo() {
  let stored: unknown[] = [];
  const accountUpdates: { id: string; category: string }[] = [];
  return {
    accountUpdates,
    list: async () => stored as never,
    replaceAll: async (categories: never[], updates: { id: string; category: string }[]) => {
      stored = categories;
      accountUpdates.push(...updates);
      return categories;
    },
  };
}

function fakeAccounts(
  initial: { id: string; category: string; description: string }[],
): AccountsForReclassify {
  return {
    list: async () => initial,
  };
}

describe('saveCategories', () => {
  test('replaces categories and reclassifies matching accounts', async () => {
    const accounts = fakeAccounts([
      { id: 'a1', category: 'x', description: 'conta de luz' },
      { id: 'a2', category: 'y', description: 'padaria' },
    ]);
    const repo = fakeRepo();
    const result = await saveCategories(repo, accounts, [{ name: 'Energia', keywords: 'luz' }]);
    expect(result.reclassified).toBe(1);
    expect(repo.accountUpdates).toEqual([{ id: 'a1', category: 'Energia' }]);
    expect(result.categories[0]).toMatchObject({ name: 'Energia', position: 0 });
    expect(result.categories[0]?.id).toMatch(/.+/);
  });

  test('rejects invalid input', async () => {
    await expect(saveCategories(fakeRepo(), fakeAccounts([]), [{ name: '' }])).rejects.toThrow(
      CategoryValidationError,
    );
  });
});
