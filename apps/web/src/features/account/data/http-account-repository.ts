import { ApiError, type ApiClient } from '@/shared/lib/api-client';
import {
  loginCondoSchema,
  parseLoginResponse,
  type LoginCondo,
  type LoginResponse,
} from '@/features/session/domain/login-response';

import type { UserAccountRepository } from '../domain/account-repository';
import type { SignUpInput } from '../domain/account-schemas';
import { AccountError, type AccountErrorKind } from '../domain/errors';

const KIND_BY_STATUS: Readonly<Record<number, AccountErrorKind>> = {
  400: 'invalid-input',
  401: 'invalid-credentials',
  403: 'email-not-confirmed',
  404: 'invalid-link',
  429: 'rate-limited',
  503: 'email-unavailable',
};

function toAccountError(error: unknown): AccountError {
  if (error instanceof ApiError)
    return new AccountError(KIND_BY_STATUS[error.status] ?? 'unavailable');
  return new AccountError('unavailable');
}

async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toAccountError(error);
  }
}

export class HttpUserAccountRepository implements UserAccountRepository {
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

  createCondo(name: string): Promise<LoginCondo> {
    return attempt(async () => loginCondoSchema.parse(await this.api.post('/me/condos', { name })));
  }
}
