import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { DisabledEmailSender } from '../../platform/email/email-sender';
import type { MembroInvitation } from '../../invitations/domain/invitation';
import type { OrgInvitationRepository } from '../../invitations/domain/invitation-repository';
import {
  OrgCondoNotFoundError,
  OrgMemberNotFoundError,
  OrganizationNotFoundError,
  OwnerCondosError,
  OwnerDeactivationError,
  SelfDeactivationError,
} from '../domain/errors';
import type { OrgMembership, OrganizationRepository } from '../domain/organization-repository';

import { assignCondos } from './assign-condos';
import { deactivateMember } from './deactivate-member';
import { getOrganization } from './get-organization';
import { inviteMember, revokeMemberInvitation } from './invite-member';
import { renameOrganization } from './rename-organization';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const ORG = { id: 'org-a', name: 'Equipe A' };

function fakeOrganizations(memberships: Record<string, OrgMembership> = {}) {
  const calls: string[] = [];
  const repo: OrganizationRepository = {
    isActiveOwner: async (orgId, userId) =>
      orgId === ORG.id && memberships[userId]?.role === 'owner',
    get: async (orgId) => (orgId === ORG.id ? ORG : null),
    rename: async (orgId, name) => {
      calls.push(`rename:${orgId}:${name}`);
      return { id: orgId, name };
    },
    members: async () => [
      {
        userId: 'u-owner',
        name: 'Dona',
        email: 'd@x.com',
        role: 'owner',
        active: true,
        condoIds: [],
      },
    ],
    condos: async () => [{ id: 'c-1', name: 'Bloco 1' }],
    member: async (_orgId, userId) => memberships[userId] ?? null,
    deactivateMember: async (orgId, userId) => {
      calls.push(`deactivate:${orgId}:${userId}`);
    },
    assignCondos: async (orgId, userId, condoIds) => {
      calls.push(`assign:${orgId}:${userId}:${condoIds.join(',')}`);
      if (condoIds.includes('c-x')) throw new OrgCondoNotFoundError();
      return [...new Set(condoIds)].sort();
    },
  };
  return { repo, calls };
}

function membroInvitation(overrides: Partial<MembroInvitation> = {}): MembroInvitation {
  return {
    id: 'inv-m',
    role: 'membro',
    organizationId: ORG.id,
    orgRole: 'member',
    email: 'equipe@x.com',
    status: 'pendente',
    expiresAt: new Date(NOW.getTime() + 60_000),
    createdBy: 'u-owner',
    claimedBy: null,
    acceptedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function fakeInvitations(pending: MembroInvitation[] = []) {
  const calls: string[] = [];
  const repo: OrgInvitationRepository = {
    pending: async () => pending,
    create: async (input) => {
      calls.push(`create:${input.organizationId}:${input.email}:${input.orgRole}`);
      return membroInvitation({
        email: input.email,
        orgRole: input.orgRole,
        expiresAt: input.expiresAt,
      });
    },
    revoke: async (orgId, id) => {
      calls.push(`revoke:${orgId}:${id}`);
      return id === 'inv-m';
    },
  };
  return { repo, calls };
}

const owner: OrgMembership = { role: 'owner', active: true };
const member: OrgMembership = { role: 'member', active: true };

describe('organization team', () => {
  test('getOrganization combines members, condos and pending invitations', async () => {
    const { repo } = fakeOrganizations();
    const invitation = membroInvitation();

    const view = await getOrganization(
      { organizations: repo, invitations: fakeInvitations([invitation]).repo },
      ORG.id,
      NOW,
    );

    expect(view).toEqual({
      id: ORG.id,
      name: ORG.name,
      members: await repo.members(ORG.id),
      condos: [{ id: 'c-1', name: 'Bloco 1' }],
      invitations: [
        { id: 'inv-m', email: 'equipe@x.com', orgRole: 'member', expiresAt: invitation.expiresAt },
      ],
    });
  });

  test('getOrganization of an unknown organization is 404', async () => {
    await expect(
      getOrganization(
        { organizations: fakeOrganizations().repo, invitations: fakeInvitations().repo },
        'org-ghost',
        NOW,
      ),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
  });

  test('renameOrganization trims the name', async () => {
    const { repo, calls } = fakeOrganizations();

    expect(await renameOrganization(repo, ORG.id, { name: '  Nova  ' })).toEqual({
      id: ORG.id,
      name: 'Nova',
    });
    expect(calls).toEqual(['rename:org-a:Nova']);
  });

  test.each([undefined, {}, { name: '  ' }, { name: 'a'.repeat(81) }])(
    'renameOrganization rejects %p',
    async (body) => {
      const { repo, calls } = fakeOrganizations();

      await expect(renameOrganization(repo, ORG.id, body)).rejects.toMatchObject({
        name: 'ZodError',
      });
      expect(calls).toEqual([]);
    },
  );

  test('deactivateMember refuses yourself, an owner and an outsider', async () => {
    const { repo, calls } = fakeOrganizations({ 'u-owner': owner, 'u-socio': owner });

    await expect(deactivateMember(repo, ORG.id, 'u-owner', 'u-owner')).rejects.toBeInstanceOf(
      SelfDeactivationError,
    );
    await expect(deactivateMember(repo, ORG.id, 'u-owner', 'u-socio')).rejects.toBeInstanceOf(
      OwnerDeactivationError,
    );
    await expect(deactivateMember(repo, ORG.id, 'u-owner', 'u-out')).rejects.toBeInstanceOf(
      OrgMemberNotFoundError,
    );
    expect(calls).toEqual([]);
  });

  test('deactivateMember deactivates a member', async () => {
    const { repo, calls } = fakeOrganizations({ 'u-owner': owner, 'u-member': member });

    await deactivateMember(repo, ORG.id, 'u-owner', 'u-member');

    expect(calls).toEqual(['deactivate:org-a:u-member']);
  });

  test('assignCondos sets the condos of a member', async () => {
    const { repo, calls } = fakeOrganizations({ 'u-member': member });

    expect(await assignCondos(repo, ORG.id, 'u-member', { condoIds: ['c-2', 'c-1'] })).toEqual({
      condoIds: ['c-1', 'c-2'],
    });
    expect(calls).toEqual(['assign:org-a:u-member:c-2,c-1']);
  });

  test('assignCondos refuses an owner, an outsider and an invalid body', async () => {
    const { repo, calls } = fakeOrganizations({ 'u-owner': owner });

    await expect(
      assignCondos(repo, ORG.id, 'u-owner', { condoIds: ['c-1'] }),
    ).rejects.toBeInstanceOf(OwnerCondosError);
    await expect(assignCondos(repo, ORG.id, 'u-out', { condoIds: ['c-1'] })).rejects.toBeInstanceOf(
      OrgMemberNotFoundError,
    );
    await expect(assignCondos(repo, ORG.id, 'u-owner', { condoIds: 'c-1' })).rejects.toMatchObject({
      name: 'ZodError',
    });
    expect(calls).toEqual([]);
  });

  test('inviteMember stores the invite, e-mails it and builds the whatsapp link', async () => {
    const sender = new InMemoryEmailSender();
    const invitations = fakeInvitations();

    const created = await inviteMember(
      {
        organizations: fakeOrganizations().repo,
        invitations: invitations.repo,
        email: sender,
        appUrl: 'https://app.test',
        now: () => NOW,
      },
      ORG.id,
      'u-owner',
      { email: ' EQUIPE@x.com ', orgRole: 'owner', phone: '(11) 98888-7777' },
    );

    expect(created).toMatchObject({ status: 'pendente', email: 'equipe@x.com', emailSent: true });
    expect(created.link).toMatch(/^https:\/\/app\.test\/#\/convite\/.+/);
    expect(created.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    expect(sender.lastTo('equipe@x.com')?.subject).toBe(
      'Você foi convidado para a equipe Equipe A',
    );
    expect(invitations.calls).toEqual(['create:org-a:equipe@x.com:owner']);
  });

  test('inviteMember reports emailSent false when e-mail is unavailable', async () => {
    const created = await inviteMember(
      {
        organizations: fakeOrganizations().repo,
        invitations: fakeInvitations().repo,
        email: new DisabledEmailSender(),
        appUrl: 'https://app.test',
        now: () => NOW,
      },
      ORG.id,
      'u-owner',
      { email: 'equipe@x.com', orgRole: 'member' },
    );

    expect(created.emailSent).toBe(false);
    expect(created.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  test('inviteMember rejects a bad body and an unknown organization', async () => {
    const deps = {
      organizations: fakeOrganizations().repo,
      invitations: fakeInvitations().repo,
      email: new InMemoryEmailSender(),
      appUrl: 'https://app.test',
      now: () => NOW,
    };

    await expect(
      inviteMember(deps, ORG.id, 'u-owner', { email: 'x@x.com', orgRole: 'chefe' }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      inviteMember(deps, 'org-ghost', 'u-owner', { email: 'x@x.com', orgRole: 'member' }),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
  });

  test('revokeMemberInvitation is 404 when nothing pending was revoked', async () => {
    const invitations = fakeInvitations();

    await revokeMemberInvitation(invitations.repo, ORG.id, 'inv-m');
    await expect(
      revokeMemberInvitation(invitations.repo, ORG.id, 'inv-other'),
    ).rejects.toMatchObject({ status: 404, message: 'Convite não encontrado' });
    expect(invitations.calls).toEqual(['revoke:org-a:inv-m', 'revoke:org-a:inv-other']);
  });
});
