import { Hono } from 'hono';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import { createNotice } from '../../app/create-notice';
import { dismissNotice } from '../../app/dismiss-notice';
import { listNotices } from '../../app/list-notices';
import { noticeDraftSchema } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

export function noticeRoutes(repo: NoticeRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => {
    const viewerResidentId = c.get('role') === 'admin' ? null : c.get('sub');
    return c.json(await listNotices(repo, viewerResidentId));
  });

  app.post('/', requireRole('admin'), async (c) => {
    const draft = noticeDraftSchema.parse(await c.req.json());
    return c.json(await createNotice(repo, draft), 201);
  });

  app.post('/:id/dismiss', async (c) =>
    c.json(await dismissNotice(repo, c.req.param('id'), c.get('sub'))),
  );

  app.delete('/:id', requireRole('admin'), async (c) => {
    await repo.remove(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
