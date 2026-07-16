import { CategoryValidationError } from '../domain/errors';
import { saveCategories, type AccountsForReclassify } from './save-categories';

function fakeRepo() {
  let stored: unknown[] = [];
  return {
    list: async () => stored as never,
    replaceAll: async (categories: never[]) => {
      stored = categories;
      return categories;
    },
  };
}

function fakeAccounts(
  initial: { id: string; category: string; description: string }[],
): AccountsForReclassify & { saved: { id: string; category: string }[] } {
  const saved: { id: string; category: string }[] = [];
  return {
    saved,
    list: async () => initial,
    save: async (a) => {
      saved.push({ id: a.id, category: a.category });
    },
  };
}

describe('saveCategories', () => {
  test('replaces categories and reclassifies matching accounts', async () => {
    const accounts = fakeAccounts([
      { id: 'a1', category: 'x', description: 'conta de luz' },
      { id: 'a2', category: 'y', description: 'padaria' },
    ]);
    const result = await saveCategories(fakeRepo(), accounts, [
      { name: 'Energia', keywords: 'luz' },
    ]);
    expect(result.reclassified).toBe(1);
    expect(accounts.saved).toEqual([{ id: 'a1', category: 'Energia' }]);
    expect(result.categories[0]).toMatchObject({ name: 'Energia', position: 0 });
    expect(result.categories[0]?.id).toMatch(/.+/);
  });

  test('rejects invalid input', async () => {
    await expect(saveCategories(fakeRepo(), fakeAccounts([]), [{ name: '' }])).rejects.toThrow(
      CategoryValidationError,
    );
  });
});
