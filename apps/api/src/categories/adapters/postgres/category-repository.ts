import type { Pool } from 'pg';

import { categorySchema, type Category } from '../../domain/category';
import type { CategoryAccountUpdate, CategoryRepository } from '../../domain/category-repository';

interface CategoryRow {
  id: string;
  name: string;
  keywords: string;
  position: number;
}

export class PostgresCategoryRepository implements CategoryRepository {
  constructor(
    private readonly pool: Pool,
    private readonly condominiumId: string,
  ) {}

  async list(): Promise<Category[]> {
    const { rows } = await this.pool.query<CategoryRow>(
      'SELECT id, name, keywords, position FROM categories WHERE condominium_id = $1 ORDER BY position',
      [this.condominiumId],
    );
    return rows.map((row) => categorySchema.parse(row));
  }

  async replaceAll(
    categories: Category[],
    accountUpdates: CategoryAccountUpdate[],
  ): Promise<Category[]> {
    const parsed = categories.map((category, index) =>
      categorySchema.parse({ ...category, position: index }),
    );
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const update of accountUpdates) {
        await client.query(
          'UPDATE accounts SET category = $2 WHERE id = $1 AND condominium_id = $3',
          [update.id, update.category, this.condominiumId],
        );
      }
      await client.query('DELETE FROM categories WHERE condominium_id = $1', [this.condominiumId]);
      for (const category of parsed) {
        await client.query(
          'INSERT INTO categories (id, name, keywords, position, condominium_id) VALUES ($1, $2, $3, $4, $5)',
          [category.id, category.name, category.keywords, category.position, this.condominiumId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return parsed;
  }
}
