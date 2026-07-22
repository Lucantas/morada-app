import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { categoryDraftSchema, categorySchema, type Category } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';
import { CategoryValidationError } from '../domain/errors';
import { reclassifyAccounts } from '../domain/reclassify';

export type AccountsForReclassify = {
  list(): Promise<{ id: string; category: string; description: string }[]>;
};

export async function saveCategories(
  repo: CategoryRepository,
  accounts: AccountsForReclassify,
  input: unknown,
): Promise<{ categories: Category[]; reclassified: number }> {
  const parsed = z.array(categoryDraftSchema).safeParse(input);
  if (!parsed.success) throw new CategoryValidationError('Categorias inválidas');
  const categories = parsed.data.map((category, index) =>
    categorySchema.parse({ ...category, id: category.id ?? randomUUID(), position: index }),
  );
  const current = await accounts.list();
  const { changed, reclassified } = reclassifyAccounts(categories, current);
  const saved = await repo.replaceAll(
    categories,
    changed.map((account) => ({ id: account.id, category: account.category })),
  );
  return { categories: saved, reclassified };
}
