import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { deleteIncome } from '../../app/delete-income';
import { listIncomes } from '../../app/list-incomes';
import { saveIncome } from '../../app/save-income';
import type { IncomeRepository } from '../../domain/income-repository';

export function incomeRoutes(repo: IncomeRepository): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await listIncomes(repo)));
  app.post('/', async (c) => c.json(await saveIncome(repo, await c.req.json()), 201));
  app.put('/:id', async (c) =>
    c.json(await saveIncome(repo, { ...(await c.req.json()), id: c.req.param('id') })),
  );
  app.delete('/:id', async (c) => {
    await deleteIncome(repo, c.req.param('id'));
    return c.body(null, 204);
  });
  return app;
}
