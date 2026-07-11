import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Domain/app errors carry a numeric `status` (e.g. 404, 400). Everything else is
 * a 500. Nothing is swallowed — the message is returned as an explicit error body.
 */
export const onError: ErrorHandler = (err, c) => {
  if (err.name === 'ZodError') {
    return c.json({ error: 'Dados inválidos', details: JSON.parse(err.message) }, 400);
  }
  const raw = (err as { status?: unknown }).status;
  const status: ContentfulStatusCode =
    typeof raw === 'number' && raw >= 400 && raw < 600 ? (raw as ContentfulStatusCode) : 500;
  return c.json({ error: err.message }, status);
};
