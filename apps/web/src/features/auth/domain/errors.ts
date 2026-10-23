export type AuthErrorKind =
  | 'invalid-credentials'
  | 'invalid-link'
  | 'rate-limited'
  | 'email-unavailable'
  | 'email-not-confirmed'
  | 'session-expired'
  | 'invalid-input'
  | 'unavailable';

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = 'AuthError';
  }
}

export function authErrorKind(error: unknown): AuthErrorKind {
  return error instanceof AuthError ? error.kind : 'unavailable';
}
