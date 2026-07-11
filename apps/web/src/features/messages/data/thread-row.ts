import { threadSchema, type Thread } from '../domain/message';

/** Parses untrusted seed/API data into a domain Thread. Raw rows never leak up. */
export function toThread(raw: unknown): Thread {
  return threadSchema.parse(raw);
}
