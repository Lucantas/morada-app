import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import { requireRole, type ApiEnv } from '../../../platform/auth';
import { ThreadNotFoundError } from '../../domain/errors';
import type { Thread } from '../../domain/message';
import { listThreads } from '../../app/list-threads';
import { markRead } from '../../app/mark-read';
import { postMessage } from '../../app/post-message';
import type { ThreadRepository } from '../../domain/thread-repository';

// `text` only — the author is derived from the verified JWT role, never trusted
// from the client (prevents impersonating the admin).
const postMessageSchema = z.object({ text: z.string().min(1).max(2000) });

// Resolves the resident behind a thread id, so a thread can be materialised
// on demand with the resident's real name/apt (a resident's thread id is their id).
export type ThreadResidentLookup = (
  residentId: string,
) => Promise<{ name: string; apt: string } | null>;

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

export function threadRoutes(repo: ThreadRepository, residentLookup: ThreadResidentLookup) {
  const app = new Hono<ApiEnv>();

  // A thread is created lazily the first time it is opened/written, so residents
  // start with an empty conversation rather than a 404.
  async function loadOrEmpty(id: string): Promise<Thread> {
    const existing = await repo.getById(id);
    if (existing) return existing;
    const resident = await residentLookup(id);
    if (!resident) throw new ThreadNotFoundError(id);
    return { id, residentName: resident.name, apt: resident.apt, unread: false, messages: [] };
  }

  app.get('/', requireRole('admin'), async (c) => c.json(await listThreads(repo)));

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const denied = denyForeignThread(c, id);
    return denied ?? c.json(await loadOrEmpty(id));
  });

  app.post('/:id/messages', async (c) => {
    const id = c.req.param('id');
    const denied = denyForeignThread(c, id);
    if (denied) return denied;
    if (!(await repo.getById(id))) await repo.save(await loadOrEmpty(id));
    const { text } = postMessageSchema.parse(await c.req.json());
    const author = c.get('role') ?? 'resident';
    return c.json(await postMessage(repo, id, author, text));
  });

  app.post('/:id/read', async (c) => {
    const id = c.req.param('id');
    const denied = denyForeignThread(c, id);
    if (denied) return denied;
    return c.json((await repo.getById(id)) ? await markRead(repo, id) : await loadOrEmpty(id));
  });

  return app;
}
