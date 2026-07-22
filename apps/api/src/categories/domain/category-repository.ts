import type { Category } from './category';

export type CategoryAccountUpdate = { id: string; category: string };

export interface CategoryRepository {
  list(): Promise<Category[]>;
  replaceAll(categories: Category[], accountUpdates: CategoryAccountUpdate[]): Promise<Category[]>;
}
