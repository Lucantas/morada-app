import { Hono } from 'hono';

import type { ApiEnv } from '../../../platform/auth';
import { createNotice } from '../../app/create-notice';
import { dismissNotice } from '../../app/dismiss-notice';
import { listNotices } from '../../app/list-notices';
import { noticeDraftSchema } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

export function noticeRoutes(repo: NoticeRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listNotices(repo)));

  app.post('/', async (c) => {
    const draft = noticeDraftSchema.parse(await c.req.json());
    return c.json(createNotice(repo, draft), 201);
  });

  app.post('/:id/dismiss', (c) => c.json(dismissNotice(repo, c.req.param('id'))));

  app.delete('/:id', (c) => {
    repo.remove(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
