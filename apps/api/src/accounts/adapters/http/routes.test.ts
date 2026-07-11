import { Hono } from 'hono';

import { createTestDb } from '../../../platform/db';
import { SqliteAccountRepository } from '../sqlite/account-repository';

import { accountRoutes } from './routes';

function mountApp() {
  const repo = new SqliteAccountRepository(createTestDb());
  const app = new Hono();
  app.route('/', accountRoutes(repo));
  return { app, repo };
}

describe('accountRoutes', () => {
  test('GET / returns the account list', async () => {
    const { app, repo } = mountApp();
    repo.save({
      id: 'a-1',
      description: 'Energia',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 5000,
      status: 'pendente',
    });

    const res = await app.request('/');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body).toHaveLength(1);
    expect(body.map((a) => a.id)).toEqual(['a-1']);
  });

  test('POST / creates an account and responds 201', async () => {
    const { app, repo } = mountApp();

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Água',
        category: 'Utilidades',
        dateLabel: '2026-07-10',
        valueCents: 3000,
        status: 'pago',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/.+/);
    expect(repo.getById(body.id)?.description).toBe('Água');
  });

  test('GET /:id returns a single account', async () => {
    const { app, repo } = mountApp();
    repo.save({
      id: 'a-9',
      description: 'Gás',
      category: 'Utilidades',
      dateLabel: '2026-07-10',
      valueCents: 1200,
      status: 'atrasado',
    });

    const res = await app.request('/a-9');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { description: string };
    expect(body.description).toBe('Gás');
  });
});
