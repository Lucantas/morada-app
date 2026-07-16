import type { Category, CategoryDraft } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

export class InMemoryCategoryRepository implements CategoryRepository {
  private categories: Category[];

  constructor(initial: Category[] = []) {
    this.categories = initial;
  }

  async list(): Promise<Category[]> {
    return this.categories;
  }

  async save(drafts: CategoryDraft[]): Promise<{ categories: Category[]; reclassified: number }> {
    this.categories = drafts.map((draft, index) => ({
      id: draft.id ?? `category-${index + 1}`,
      name: draft.name,
      keywords: draft.keywords,
      position: index,
    }));
    return { categories: this.categories, reclassified: 0 };
  }

  snapshot(): Category[] {
    return this.categories;
  }
}
