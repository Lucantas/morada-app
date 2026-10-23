import { Hono } from 'hono';

import { logServerError } from '../../../platform/http-error';
import type { ApiEnv } from '../../../platform/auth';
import { ACTIVITY_LABELS } from '../../domain/activity';

import { MONEY_ACTIVITY_TABLE, moneyActivityResolver } from './money-activity';
import { recordActivity } from './record-activity';

jest.mock('../../../platform/http-error', () => ({ logServerError: jest.fn() }));

function appWith(status: number, failing = false) {
  const recorded: unknown[] = [];
  const app = new Hono<ApiEnv>();
  app.use('*', async (c, next) => {
    c.set('uid', 'u-1');
    c.set('condoId', 'c-1');
    await next();
  });
  app.use(
    '*',
    recordActivity(
      () => 'account.created',
      () => ({
        record: async (entry) => {
          if (failing) throw new Error('db down');
          recorded.push(entry);
        },
      }),
      () => new Date('2026-05-01T10:00:00Z'),
    ),
  );
  app.post('/things/:id', (c) => c.body(null, status as 200));
  app.get('/things/:id', (c) => c.json({}));
  return { app, recorded };
}

describe('recordActivity', () => {
  test('a failing recorder is logged and the original response is kept', async () => {
    const { app } = appWith(201, true);

    const res = await app.request('/things/t-1', { method: 'POST' });

    expect(res.status).toBe(201);
    expect(logServerError).toHaveBeenCalledWith('Activity log failed:', expect.any(Error));
  });

  test('records the actor, action, subject and time on a 2xx write', async () => {
    const { app, recorded } = appWith(201);

    await app.request('/things/t-1', { method: 'POST' });

    expect(recorded).toEqual([
      {
        actorUserId: 'u-1',
        action: 'account.created',
        subjectId: 't-1',
        at: new Date('2026-05-01T10:00:00Z'),
      },
    ]);
  });

  test('does not record failed writes', async () => {
    const { app, recorded } = appWith(400);

    await app.request('/things/t-1', { method: 'POST' });

    expect(recorded).toEqual([]);
  });

  test('does not record reads', async () => {
    const { app, recorded } = appWith(200);

    await app.request('/things/t-1');

    expect(recorded).toEqual([]);
  });

  test('every table entry has a label and unknown routes resolve to null', () => {
    for (const action of Object.values(MONEY_ACTIVITY_TABLE)) {
      expect(ACTIVITY_LABELS[action]).toBeTruthy();
    }
    expect(moneyActivityResolver('POST', '/nope')).toBeNull();
  });
});
