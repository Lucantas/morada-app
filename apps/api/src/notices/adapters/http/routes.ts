import { Hono } from 'hono';

import type { Scoped } from '../../../platform/condo-scope';
import { requireRole, type ApiEnv } from '../../../platform/auth';
import { createNotice } from '../../app/create-notice';
import { dismissNotice } from '../../app/dismiss-notice';
import { listNotices } from '../../app/list-notices';
import { noticeDraftSchema } from '../../domain/notice';
import type { NoticeRepository } from '../../domain/notice-repository';

interface NoticeRoutesDeps {
  notices: NoticeRepository;
}

export function noticeRoutes(scope: Scoped<NoticeRoutesDeps>) {
  const app = new Hono<ApiEnv>();

  app.get('/', async (c) => {
    const { notices: repo } = scope(c.get('condoId'));
    const viewerResidentId = c.get('role') === 'admin' ? null : c.get('sub');
    return c.json(await listNotices(repo, viewerResidentId));
  });

  app.post('/', requireRole('admin'), async (c) => {
    const { notices: repo } = scope(c.get('condoId'));
    const draft = noticeDraftSchema.parse(await c.req.json());
    return c.json(await createNotice(repo, draft), 201);
  });

  app.post('/:id/dismiss', async (c) =>
    c.json(await dismissNotice(scope(c.get('condoId')).notices, c.req.param('id'), c.get('sub'))),
  );

  app.delete('/:id', requireRole('admin'), async (c) => {
    await scope(c.get('condoId')).notices.remove(c.req.param('id'));
    return c.body(null, 204);
  });

  return app;
}
