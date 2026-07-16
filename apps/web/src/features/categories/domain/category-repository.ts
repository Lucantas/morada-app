import type { Category, CategoryDraft } from './category';

export interface CategoryRepository {
  list(): Promise<Category[]>;
  save(categories: CategoryDraft[]): Promise<{ categories: Category[]; reclassified: number }>;
}
