import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CategoryDraft } from '../domain/category';
import type { CategoryRepository } from '../domain/category-repository';

export const categoriesQueryKey = ['categories'] as const;

export function useCategories(repository: CategoryRepository) {
  return useQuery({ queryKey: categoriesQueryKey, queryFn: () => repository.list() });
}

export function useSaveCategories(repository: CategoryRepository) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories: CategoryDraft[]) => repository.save(categories),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
  });
}
