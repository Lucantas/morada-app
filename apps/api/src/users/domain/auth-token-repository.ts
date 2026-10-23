import type { AuthTokenKind } from './auth-token';

export interface IssueAuthToken {
  userId: string;
  kind: AuthTokenKind;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthTokenRepository {
  issue(token: IssueAuthToken): Promise<void>;
  consume(tokenHash: string, kind: AuthTokenKind, now: Date): Promise<{ userId: string } | null>;
  revokeAll(userId: string, kind: AuthTokenKind, now: Date): Promise<void>;
}
