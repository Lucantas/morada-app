import { Hono } from 'hono';
import { z } from 'zod';

import type { ApiEnv } from '../../../platform/auth';
import { getThread } from '../../app/get-thread';
import { listThreads } from '../../app/list-threads';
import { markRead } from '../../app/mark-read';
import { postMessage } from '../../app/post-message';
import type { ThreadRepository } from '../../domain/thread-repository';

const postMessageSchema = z.object({
  author: z.enum(['resident', 'admin']),
  text: z.string(),
});

export function threadRoutes(repo: ThreadRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listThreads(repo)));

  app.get('/:id', (c) => c.json(getThread(repo, c.req.param('id'))));

  app.post('/:id/messages', async (c) => {
    const { author, text } = postMessageSchema.parse(await c.req.json());
    return c.json(postMessage(repo, c.req.param('id'), author, text));
  });

  app.post('/:id/read', (c) => c.json(markRead(repo, c.req.param('id'))));

  return app;
}
