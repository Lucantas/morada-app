export type AccountErrorKind =
  | 'invalid-credentials'
  | 'invalid-link'
  | 'rate-limited'
  | 'email-unavailable'
  | 'email-not-confirmed'
  | 'invalid-input'
  | 'unavailable';

export class AccountError extends Error {
  constructor(readonly kind: AccountErrorKind) {
    super(kind);
    this.name = 'AccountError';
  }
}

export function accountErrorKind(error: unknown): AccountErrorKind {
  return error instanceof AccountError ? error.kind : 'unavailable';
}
