import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import type { ApiEnv } from '../../../platform/auth';
import { getThread } from '../../app/get-thread';
import { listThreads } from '../../app/list-threads';
import { markRead } from '../../app/mark-read';
import { postMessage } from '../../app/post-message';
import type { ThreadRepository } from '../../domain/thread-repository';

// `text` only — the author is derived from the verified JWT role, never trusted
// from the client (prevents impersonating the admin).
const postMessageSchema = z.object({ text: z.string().min(1).max(2000) });

/**
 * A resident may only touch their own thread (their JWT `sub`). Admins are
 * unrestricted. Returns a 403 Response to short-circuit, or null to proceed.
 * When there is no auth context (role unset, e.g. isolated unit tests) it is
 * permissive — the composition root always mounts this behind authMiddleware.
 */
function denyForeignThread(c: Context<ApiEnv>, threadId: string): Response | null {
  const role = c.get('role');
  if (role === 'resident' && c.get('sub') !== threadId) {
    return c.json({ error: 'Acesso negado' }, 403);
  }
  return null;
}

export function threadRoutes(repo: ThreadRepository) {
  const app = new Hono<ApiEnv>();

  app.get('/', (c) => c.json(listThreads(repo)));

  app.get('/:id', (c) => {
    const denied = denyForeignThread(c, c.req.param('id'));
    return denied ?? c.json(getThread(repo, c.req.param('id')));
  });

  app.post('/:id/messages', async (c) => {
    const id = c.req.param('id');
    const denied = denyForeignThread(c, id);
    if (denied) return denied;
    const { text } = postMessageSchema.parse(await c.req.json());
    const author = c.get('role') ?? 'resident';
    return c.json(postMessage(repo, id, author, text));
  });

  app.post('/:id/read', (c) => {
    const denied = denyForeignThread(c, c.req.param('id'));
    return denied ?? c.json(markRead(repo, c.req.param('id')));
  });

  return app;
}
