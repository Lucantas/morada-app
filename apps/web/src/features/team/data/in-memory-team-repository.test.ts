import { TEAM } from '@/test/factories.team';

import { TeamError } from '../domain/errors';

import { InMemoryTeamRepository } from './in-memory-team-repository';

describe('InMemoryTeamRepository', () => {
  test('renames the organization', async () => {
    const repository = new InMemoryTeamRepository(TEAM);

    await repository.rename('Nova');

    expect((await repository.get()).name).toBe('Nova');
  });

  test('assigns condos to a member without touching the seed', async () => {
    const repository = new InMemoryTeamRepository(TEAM);

    await repository.assignCondos('u2', ['c1', 'c2']);

    const member = (await repository.get()).members.find((m) => m.userId === 'u2');
    expect(member?.condoIds).toEqual(['c1', 'c2']);
    expect(TEAM.members.find((m) => m.userId === 'u2')?.condoIds).toEqual(['c1']);
  });

  test('deactivates a member but refuses owners', async () => {
    const repository = new InMemoryTeamRepository(TEAM);

    await repository.deactivateMember('u2');

    const members = (await repository.get()).members;
    expect(members.find((m) => m.userId === 'u2')?.active).toBe(false);
    await expect(repository.deactivateMember('u1')).rejects.toEqual(
      new TeamError('Não é possível desativar um dono'),
    );
  });

  test('invites and revokes', async () => {
    const repository = new InMemoryTeamRepository(TEAM);

    const created = await repository.invite('x@y.com', 'member');
    expect(created.email).toBe('x@y.com');
    expect((await repository.get()).invitations.map((i) => i.email)).toContain('x@y.com');

    await repository.revokeInvitation('i1');
    expect((await repository.get()).invitations.find((i) => i.id === 'i1')).toBeUndefined();
  });

  test('rejects an unknown member', async () => {
    const repository = new InMemoryTeamRepository(TEAM);

    await expect(repository.assignCondos('nope', [])).rejects.toEqual(
      new TeamError('Membro não encontrado'),
    );
  });
});
