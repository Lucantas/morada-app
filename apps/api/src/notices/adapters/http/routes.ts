import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { createNotice } from '../../app/create-notice';
import { dismissNotice } from '../../app/dismiss-notice';
import { listNotices } from '../../app/list-notices';
import { noticeDraftSchema } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

export function noticeRoutes(repo: NoticeRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => c.json(await listNotices(repo)));

  app.post('/', async (c) => {
    const draft = noticeDraftSchema.parse(await c.req.json());
    return c.json(await createNotice(repo, draft), 201);
  });

  app.post('/:id/dismiss', async (c) => c.json(await dismissNotice(repo, c.req.param('id'))));

  app.delete('/:id', async (c) => {
    await repo.remove(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
