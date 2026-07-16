import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { getCategories } from '../../app/get-categories';
import { saveCategories, type AccountsForReclassify } from '../../app/save-categories';
import type { CategoryRepository } from '../../domain/category-repository';

export function categoryRoutes(
  repo: CategoryRepository,
  accounts: AccountsForReclassify,
): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await getCategories(repo)));
  app.put('/', async (c) => c.json(await saveCategories(repo, accounts, await c.req.json())));
  return app;
}
