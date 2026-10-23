import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

import { InvitationError } from '../domain/errors';

import { HttpInvitationRepository } from './http-invitation-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn(), ...overrides };
}

const VIEW = {
  status: 'pendente',
  email: 'ana@exemplo.com',
  expiresAt: '2026-10-30T15:00:00.000Z',
};
const CREATED = {
  ...VIEW,
  link: 'https://morada.app/#/convite/abc',
  whatsappUrl: 'https://wa.me/5521999990000?text=oi',
};
const PREVIEW = {
  condoName: 'Morada',
  residentName: 'Ana',
  apt: 'Apto 302',
  email: null,
  accountExists: false,
};
const LOGIN_BODY = {
  condos: [{ id: 'c1', name: 'Morada', role: 'resident' }],
  emailVerified: true,
};

function repositoryWith(api: ApiClient, publicApi: ApiClient = fakeApi()) {
  return new HttpInvitationRepository({ api, publicApi });
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof InvitationError) return error.kind;
    throw error;
  }
  throw new Error('expected an InvitationError');
}

describe('HttpInvitationRepository — admin', () => {
  test('reads the latest invitation of a resident', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue(VIEW) });

    const result = await repositoryWith(api).invitation('r-1');

    expect(api.get).toHaveBeenCalledWith('/api/residents/r-1/invitation');
    expect(result).toEqual(VIEW);
  });

  test('a resident without invitations answers null', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue(null) });

    expect(await repositoryWith(api).invitation('r-1')).toBeNull();
  });

  test('creates an invitation with the typed e-mail', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(CREATED) });

    const result = await repositoryWith(api).invite('r-1', 'ana@exemplo.com');

    expect(api.post).toHaveBeenCalledWith('/api/residents/r-1/invitation', {
      email: 'ana@exemplo.com',
    });
    expect(result).toEqual(CREATED);
  });

  test('revokes the pending invitation', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(undefined) });

    await repositoryWith(api).revoke('r-1');

    expect(api.post).toHaveBeenCalledWith('/api/residents/r-1/invitation/revoke');
  });

  test.each([
    [409, 'Morador inativo', 'inactive-resident'],
    [409, 'Já existe um convite pendente', 'pending-conflict'],
    [404, 'Morador não encontrado', 'not-found'],
    [503, 'Envio de e-mail indisponível', 'email-unavailable'],
    [400, 'x', 'invalid-input'],
    [500, 'x', 'unavailable'],
  ])('maps an admin %i "%s" to %s', async (status, message, kind) => {
    const api = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(status, message)) });

    expect(await kindOf(repositoryWith(api).invite('r-1', ''))).toBe(kind);
  });

  test('a malformed response is unavailable', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ status: 'x' }) });

    expect(await kindOf(repositoryWith(api).invitation('r-1'))).toBe('unavailable');
  });

  test('reads the legacy login username', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ username: 'ana302' }) });

    expect(await repositoryWith(api).legacyLogin('r-1')).toBe('ana302');
    expect(api.get).toHaveBeenCalledWith('/api/residents/r-1/login');
  });

  test('a resident without a legacy login answers null', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ username: null }) });

    expect(await repositoryWith(api).legacyLogin('r-1')).toBeNull();
  });

  test('resets the legacy login password', async () => {
    const api = fakeApi({
      post: jest.fn().mockResolvedValue({ username: 'ana302', tempPassword: 'Temp1234' }),
    });

    const result = await repositoryWith(api).resetLegacyLogin('r-1');

    expect(api.post).toHaveBeenCalledWith('/api/residents/r-1/login/reset', {});
    expect(result).toEqual({ username: 'ana302', tempPassword: 'Temp1234' });
  });
});

describe('HttpInvitationRepository — public', () => {
  test('previews an invitation on the public client', async () => {
    const publicApi = fakeApi({ get: jest.fn().mockResolvedValue(PREVIEW) });

    const result = await repositoryWith(fakeApi(), publicApi).preview('tok');

    expect(publicApi.get).toHaveBeenCalledWith('/auth/invitations/tok');
    expect(result).toEqual(PREVIEW);
  });

  test('accepts an invitation on the public client', async () => {
    const publicApi = fakeApi({ post: jest.fn().mockResolvedValue(LOGIN_BODY) });
    const input = { email: 'a@b.com', name: 'Ana', password: 'segredo123' };

    const result = await repositoryWith(fakeApi(), publicApi).accept('tok', input);

    expect(publicApi.post).toHaveBeenCalledWith('/auth/invitations/tok/accept', input);
    expect(result).toEqual(LOGIN_BODY);
  });

  test('encodes the token in the path', async () => {
    const publicApi = fakeApi({ get: jest.fn().mockResolvedValue(PREVIEW) });

    await repositoryWith(fakeApi(), publicApi).preview('a/b');

    expect(publicApi.get).toHaveBeenCalledWith('/auth/invitations/a%2Fb');
  });

  test.each([
    [404, 'invalid-invitation'],
    [401, 'invalid-credentials'],
    [400, 'invalid-input'],
    [429, 'rate-limited'],
    [500, 'unavailable'],
  ])('maps a public %i to %s', async (status, kind) => {
    const publicApi = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(status, 'x')) });

    expect(
      await kindOf(repositoryWith(fakeApi(), publicApi).accept('tok', { password: 'x' })),
    ).toBe(kind);
  });

  test('a network failure is unavailable', async () => {
    const publicApi = fakeApi({ get: jest.fn().mockRejectedValue(new TypeError('fetch')) });

    expect(await kindOf(repositoryWith(fakeApi(), publicApi).preview('tok'))).toBe('unavailable');
  });
});
