import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';
import { loginCondo } from '@/test/factories.auth';

import { AuthError } from '../domain/errors';

import { HttpAuthRepository } from './http-auth-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn(), ...overrides };
}

const LOGIN_BODY = { condos: [loginCondo()], emailVerified: true };

function repositoryWith(publicApi: ApiClient, api: ApiClient = fakeApi()) {
  return new HttpAuthRepository({ api, publicApi });
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AuthError) return error.kind;
    throw error;
  }
  throw new Error('expected an AuthError');
}

describe('HttpAuthRepository', () => {
  test('login posts login and password on the public client and parses the response', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue(LOGIN_BODY) });

    const result = await repositoryWith(publicApi).login('ana@exemplo.com', 'segredo123');

    expect(publicApi.post).toHaveBeenCalledWith('/auth/login', {
      login: 'ana@exemplo.com',
      password: 'segredo123',
    });
    expect(result).toEqual(LOGIN_BODY);
  });

  test.each([
    [401, 'invalid-credentials'],
    [404, 'invalid-link'],
    [429, 'rate-limited'],
    [503, 'email-unavailable'],
    [403, 'session-expired'],
    [400, 'invalid-input'],
    [500, 'unavailable'],
  ])('maps an API %i to the %s auth error', async (status, kind) => {
    const publicApi = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(status, 'x')) });

    expect(await kindOf(repositoryWith(publicApi).login('a', 'b'))).toBe(kind);
  });

  test('maps a network failure to an unavailable auth error', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockRejectedValue(new TypeError('fetch')) });

    expect(await kindOf(repositoryWith(publicApi).login('a', 'b'))).toBe('unavailable');
  });

  test('maps a malformed response to an unavailable auth error', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue({ nope: true }) });

    expect(await kindOf(repositoryWith(publicApi).login('a', 'b'))).toBe('unavailable');
  });

  test('signUp posts the new user on the public client', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue({}) });

    await repositoryWith(publicApi).signUp({
      name: 'Ana',
      email: 'ana@exemplo.com',
      password: 'segredo123',
    });

    expect(publicApi.post).toHaveBeenCalledWith('/auth/signup', {
      name: 'Ana',
      email: 'ana@exemplo.com',
      password: 'segredo123',
    });
  });

  test('confirmEmail posts the token and password and parses the login', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue(LOGIN_BODY) });

    const result = await repositoryWith(publicApi).confirmEmail('tok', 'segredo123');

    expect(publicApi.post).toHaveBeenCalledWith('/auth/email/confirm', {
      token: 'tok',
      password: 'segredo123',
    });
    expect(result).toEqual(LOGIN_BODY);
  });

  test('resendConfirmation posts on the session client', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(undefined) });

    await repositoryWith(fakeApi(), api).resendConfirmation();

    expect(api.post).toHaveBeenCalledWith('/auth/email/resend');
  });

  test('resendConfirmation maps a rejected CSRF 403 to an expired session', async () => {
    const api = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(403, 'CSRF inválido')) });

    expect(await kindOf(repositoryWith(fakeApi(), api).resendConfirmation())).toBe(
      'session-expired',
    );
  });

  test('requestPasswordReset posts the e-mail on the public client', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue(undefined) });

    await repositoryWith(publicApi).requestPasswordReset('ana@exemplo.com');

    expect(publicApi.post).toHaveBeenCalledWith('/auth/password/forgot', {
      email: 'ana@exemplo.com',
    });
  });

  test('resetPassword posts the token and new password and parses the login', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue(LOGIN_BODY) });

    const result = await repositoryWith(publicApi).resetPassword('tok', 'novasenha1');

    expect(publicApi.post).toHaveBeenCalledWith('/auth/password/reset', {
      token: 'tok',
      password: 'novasenha1',
    });
    expect(result).toEqual(LOGIN_BODY);
  });

  test('createCondo posts the name on the session client and parses the condo', async () => {
    const created = loginCondo({ id: 'c9', name: 'Edifício Sol' });
    const api = fakeApi({ post: jest.fn().mockResolvedValue(created) });

    const result = await repositoryWith(fakeApi(), api).createCondo('Edifício Sol');

    expect(api.post).toHaveBeenCalledWith('/me/condos', { name: 'Edifício Sol' });
    expect(result).toEqual(created);
  });

  test('createCondo maps a 403 to the e-mail-not-confirmed error', async () => {
    const api = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(403, 'x')) });

    expect(await kindOf(repositoryWith(fakeApi(), api).createCondo('X'))).toBe(
      'email-not-confirmed',
    );
  });
});
