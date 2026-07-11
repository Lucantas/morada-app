import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Domain/app errors carry a numeric `status` (e.g. 404, 400). Everything else is
 * a 500. Nothing is swallowed — the message is returned as an explicit error body.
 */
export const onError: ErrorHandler = (err, c) => {
  if (err.name === 'ZodError') {
    return c.json({ error: 'Dados inválidos' }, 400);
  }
  const raw = (err as { status?: unknown }).status;
  if (typeof raw === 'number' && raw >= 400 && raw < 600) {
    // Typed app errors carry a safe, user-facing message.
    return c.json({ error: err.message }, raw as ContentfulStatusCode);
  }
  // Unexpected error: don't leak internals (SQL text, stack, driver messages).
  console.error('Unhandled error:', err);
  return c.json({ error: 'Erro interno' }, 500);
};
