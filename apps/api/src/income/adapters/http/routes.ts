import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import type { Scoped } from '../../../platform/condo-scope';
import { archiveIncome } from '../../app/archive-income';
import { listIncomes } from '../../app/list-incomes';
import { saveIncome } from '../../app/save-income';
import { updateIncome } from '../../app/update-income';
import type { IncomeRepository } from '../../domain/income-repository';

interface IncomeRoutesDeps {
  incomes: IncomeRepository;
}

function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

export function incomeRoutes(scope: Scoped<IncomeRoutesDeps>): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>();
  app.get('/', async (c) => c.json(await listIncomes(scope(c.get('condoId')).incomes)));
  app.post('/', async (c) =>
    c.json(await saveIncome(scope(c.get('condoId')).incomes, await c.req.json()), 201),
  );
  app.get('/:id/proof', async (c) => {
    const { incomes: repo } = scope(c.get('condoId'));
    const income = await repo.getById(c.req.param('id'));
    if (!income) return c.json({ error: 'Entrada não encontrada' }, 404);
    const proof = await repo.getProof(income.id);
    if (!proof) return c.json({ error: 'Comprovante não encontrado' }, 404);
    return c.body(toArrayBufferView(proof.body), 200, { 'Content-Type': proof.contentType });
  });
  app.put('/:id', async (c) =>
    c.json(
      await updateIncome(scope(c.get('condoId')).incomes, c.req.param('id'), await c.req.json()),
    ),
  );
  app.delete('/:id', async (c) => {
    await archiveIncome(scope(c.get('condoId')).incomes, c.req.param('id'));
    return c.body(null, 204);
  });
  return app;
}
