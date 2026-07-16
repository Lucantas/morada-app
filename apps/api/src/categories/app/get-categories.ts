import type { Category } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

export async function getCategories(repo: CategoryRepository): Promise<Category[]> {
  return repo.list();
}
