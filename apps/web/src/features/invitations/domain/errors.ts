export type InvitationErrorKind =
  | 'invalid-invitation'
  | 'invalid-credentials'
  | 'invalid-input'
  | 'not-found'
  | 'pending-conflict'
  | 'inactive-resident'
  | 'email-unavailable'
  | 'rate-limited'
  | 'unavailable';

export class InvitationError extends Error {
  constructor(readonly kind: InvitationErrorKind) {
    super(kind);
    this.name = 'InvitationError';
  }
}

export function invitationErrorKind(error: unknown): InvitationErrorKind {
  return error instanceof InvitationError ? error.kind : 'unavailable';
}
