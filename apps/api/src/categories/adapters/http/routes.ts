import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { getCategories } from '../../app/get-categories';
import { saveCategories, type AccountsForReclassify } from '../../app/save-categories';
import type { CategoryRepository } from '../../domain/category-repository';

interface CategoryRoutesDeps {
  categories: CategoryRepository;
  accounts: AccountsForReclassify;
}

export function categoryRoutes(scope: Scoped<CategoryRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await getCategories(scope(c.get('condoId')).categories)));
  app.put('/', async (c) => {
    const { categories, accounts } = scope(c.get('condoId'));
    return c.json(await saveCategories(categories, accounts, await c.req.json()));
  });
  return app;
}
