import { ApiError, type ApiClient } from '@/shared/lib/api-client';
import { CREATED_INVITATION } from '@/test/factories.invitations';
import { TEAM } from '@/test/factories.team';

import { TeamError } from '../domain/errors';

import { HttpTeamRepository } from './http-team-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { get: jest.fn(), post: jest.fn(), put: jest.fn(), del: jest.fn(), ...overrides };
}

function repo(api: ApiClient, orgId: string | null = 'o1') {
  return new HttpTeamRepository(api, () => orgId);
}

describe('HttpTeamRepository', () => {
  test('get parses GET /api/orgs/:orgId', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue(TEAM) });

    const result = await repo(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/orgs/o1');
    expect(result).toEqual(TEAM);
  });

  test('get rejects a malformed response', async () => {
    const api = fakeApi({ get: jest.fn().mockResolvedValue({ id: 'o1' }) });

    await expect(repo(api).get()).rejects.toThrow();
  });

  test('rename puts the name', async () => {
    const api = fakeApi({ put: jest.fn().mockResolvedValue({ id: 'o1', name: 'Nova' }) });

    await repo(api).rename('Nova');

    expect(api.put).toHaveBeenCalledWith('/api/orgs/o1', { name: 'Nova' });
  });

  test('invite posts e-mail, role and phone and parses the created invitation', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(CREATED_INVITATION) });

    const result = await repo(api).invite('a@b.com', 'owner', '2199');

    expect(api.post).toHaveBeenCalledWith('/api/orgs/o1/invitations', {
      email: 'a@b.com',
      orgRole: 'owner',
      phone: '2199',
    });
    expect(result).toEqual(CREATED_INVITATION);
  });

  test('invite omits an absent phone', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(CREATED_INVITATION) });

    await repo(api).invite('a@b.com', 'member');

    expect(api.post).toHaveBeenCalledWith('/api/orgs/o1/invitations', {
      email: 'a@b.com',
      orgRole: 'member',
    });
  });

  test('revokeInvitation, deactivateMember and assignCondos hit their routes', async () => {
    const api = fakeApi({
      post: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue({ condoIds: ['c1'] }),
    });

    await repo(api).revokeInvitation('i1');
    await repo(api).deactivateMember('u2');
    await repo(api).assignCondos('u2', ['c1']);

    expect(api.post).toHaveBeenCalledWith('/api/orgs/o1/invitations/i1/revoke');
    expect(api.post).toHaveBeenCalledWith('/api/orgs/o1/members/u2/deactivate');
    expect(api.put).toHaveBeenCalledWith('/api/orgs/o1/members/u2/condos', { condoIds: ['c1'] });
  });

  test('wraps a 409 into a TeamError carrying the server message', async () => {
    const api = fakeApi({
      post: jest.fn().mockRejectedValue(new ApiError(409, 'Não é possível desativar um dono')),
    });

    await expect(repo(api).deactivateMember('u1')).rejects.toEqual(
      new TeamError('Não é possível desativar um dono'),
    );
  });

  test('maps 429, 503 and unknown failures to friendly messages', async () => {
    const failing = (status: number) =>
      repo(fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(status, 'x')) })).invite(
        'a@b.com',
        'member',
      );

    await expect(failing(429)).rejects.toThrow('Muitas tentativas, tente mais tarde.');
    await expect(failing(503)).rejects.toThrow('Envio de e-mail indisponível. Tente mais tarde.');
    await expect(failing(500)).rejects.toThrow(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
  });

  test('wraps non-API failures', async () => {
    const api = fakeApi({ post: jest.fn().mockRejectedValue(new TypeError('network')) });

    await expect(repo(api).deactivateMember('u2')).rejects.toThrow(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
  });

  test('fails explicitly without an organization', async () => {
    await expect(repo(fakeApi(), null).get()).rejects.toThrow('Nenhuma organização selecionada');
  });
});
