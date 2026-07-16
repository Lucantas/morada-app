import type { ApiClient } from '@/shared/lib/api-client';
import { z } from 'zod';

import { categorySchema, type Category, type CategoryDraft } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

const listSchema = z.array(categorySchema);
const saveSchema = z.object({ categories: listSchema, reclassified: z.number().int() });

export class HttpCategoryRepository implements CategoryRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Category[]> {
    return listSchema.parse(await this.api.get('/api/categories'));
  }

  async save(
    categories: CategoryDraft[],
  ): Promise<{ categories: Category[]; reclassified: number }> {
    return saveSchema.parse(await this.api.put('/api/categories', categories));
  }
}
