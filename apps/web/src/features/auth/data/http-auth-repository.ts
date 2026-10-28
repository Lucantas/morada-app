import { ApiError, type ApiClient } from '@/shared/lib/api-client';
import {
  loginCondoSchema,
  parseLoginResponse,
  type LoginCondo,
  type LoginResponse,
} from '@/features/session/domain/login-response';

import type { CreateCondoInput } from '@/features/condos/domain/create-condo';

import type { AuthRepository } from '../domain/auth-repository';
import type { SignUpInput } from '../domain/auth-schemas';
import { AuthError, type AuthErrorKind } from '../domain/errors';

const KIND_BY_STATUS: Readonly<Record<number, AuthErrorKind>> = {
  400: 'invalid-input',
  401: 'invalid-credentials',
  403: 'session-expired',
  404: 'invalid-link',
  429: 'rate-limited',
  503: 'email-unavailable',
};

const CREATE_CONDO_KINDS: Readonly<Record<number, AuthErrorKind>> = {
  ...KIND_BY_STATUS,
  403: 'email-not-confirmed',
};

function toAuthError(error: unknown, kinds: Readonly<Record<number, AuthErrorKind>>): AuthError {
  if (error instanceof ApiError) return new AuthError(kinds[error.status] ?? 'unavailable');
  return new AuthError('unavailable');
}

async function attempt<T>(
  run: () => Promise<T>,
  kinds: Readonly<Record<number, AuthErrorKind>> = KIND_BY_STATUS,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toAuthError(error, kinds);
  }
}

export class HttpAuthRepository implements AuthRepository {
  private readonly api: ApiClient;
  private readonly publicApi: ApiClient;

  constructor(clients: { api: ApiClient; publicApi: ApiClient }) {
    this.api = clients.api;
    this.publicApi = clients.publicApi;
  }

  login(login: string, password: string): Promise<LoginResponse> {
    return attempt(async () =>
      parseLoginResponse(await this.publicApi.post('/auth/login', { login, password })),
    );
  }

  signUp(input: SignUpInput): Promise<void> {
    return attempt(async () => {
      await this.publicApi.post('/auth/signup', input);
    });
  }

  confirmEmail(token: string, password: string): Promise<LoginResponse> {
    return attempt(async () =>
      parseLoginResponse(await this.publicApi.post('/auth/email/confirm', { token, password })),
    );
  }

  resendConfirmation(): Promise<void> {
    return attempt(async () => {
      await this.api.post('/auth/email/resend');
    });
  }

  requestPasswordReset(email: string): Promise<void> {
    return attempt(async () => {
      await this.publicApi.post('/auth/password/forgot', { email });
    });
  }

  resetPassword(token: string, password: string): Promise<LoginResponse> {
    return attempt(async () =>
      parseLoginResponse(await this.publicApi.post('/auth/password/reset', { token, password })),
    );
  }

  createCondo(input: CreateCondoInput): Promise<LoginCondo> {
    return attempt(
      async () => loginCondoSchema.parse(await this.api.post('/me/condos', input)),
      CREATE_CONDO_KINDS,
    );
  }
}
