import { accountSchema, type Account } from '../domain/account';

/** Parses untrusted seed/API data into a domain Account. Raw rows never leak up. */
export function toAccount(raw: unknown): Account {
  return accountSchema.parse(raw);
}
