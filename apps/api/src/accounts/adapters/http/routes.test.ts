import { Hono } from 'hono';

import type { Account } from '../../domain/account';
import type { AccountRepository } from '../../domain/account-repository';

import { accountRoutes } from './routes';

function fakeRepo(): AccountRepository {
  const map = new Map<string, Account>();
  return {
    list: async () => [...map.values()],
    getById: async (id) => map.get(id) ?? null,
    save: async (account) => {
      map.set(account.id, account);
      return account;
    },
    archive: async (id) => {
      map.delete(id);
    },
    getProof: async () => null,
  };
}

function mountApp() {
  const repo = fakeRepo();
  const app = new Hono();
  app.route('/', accountRoutes(repo));
  return { app, repo };
}

describe('accountRoutes', () => {
  test('GET / returns the account list', async () => {
    const { app, repo } = mountApp();
    await repo.save({
      id: 'a-1',
      description: 'Energia',
      category: 'Utilidades',
      date: '2026-04-05',
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
        date: '2026-04-05',
        valueCents: 3000,
        status: 'pago',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/.+/);
    expect((await repo.getById(body.id))?.description).toBe('Água');
  });

  test('GET /:id returns a single account', async () => {
    const { app, repo } = mountApp();
    await repo.save({
      id: 'a-9',
      description: 'Gás',
      category: 'Utilidades',
      date: '2026-04-05',
      valueCents: 1200,
      status: 'atrasado',
    });

    const res = await app.request('/a-9');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { description: string };
    expect(body.description).toBe('Gás');
  });
});
