import type { Category } from './category';

export interface CategoryRepository {
  list(): Promise<Category[]>;
  replaceAll(categories: Category[]): Promise<Category[]>;
}
