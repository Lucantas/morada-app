import type { CategoryRepository } from '../domain/category-repository';

export function runCategoryRepositoryContract(
  label: string,
  makeRepo: () => Promise<CategoryRepository>,
): void {
  describe(label, () => {
    test('list returns the seeded rows ordered by position', async () => {
      const repo = await makeRepo();
      const categories = await repo.list();
      expect(categories.map((category) => category.id)).toEqual([
        'cat-agua',
        'cat-energia',
        'cat-servicos',
        'cat-manutencao',
      ]);
      expect(categories.map((category) => category.position)).toEqual([0, 1, 2, 3]);
    });

    test('replaceAll replaces the whole set and returns it with re-indexed positions', async () => {
      const repo = await makeRepo();
      const replaced = await repo.replaceAll(
        [
          { id: 'cat-a', name: 'A', keywords: 'a', position: 5 },
          { id: 'cat-b', name: 'B', keywords: 'b', position: 9 },
        ],
        [],
      );
      expect(replaced).toEqual([
        { id: 'cat-a', name: 'A', keywords: 'a', position: 0 },
        { id: 'cat-b', name: 'B', keywords: 'b', position: 1 },
      ]);
    });

    test('list after replaceAll reflects the new set', async () => {
      const repo = await makeRepo();
      await repo.replaceAll([{ id: 'cat-only', name: 'Only', keywords: 'only', position: 0 }], []);
      expect(await repo.list()).toEqual([
        { id: 'cat-only', name: 'Only', keywords: 'only', position: 0 },
      ]);
    });
  });
}
