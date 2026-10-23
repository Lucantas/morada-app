import type {
  CondoInvitationRepository,
  InvitationTokenRepository,
  OrgInvitationRepository,
} from '../domain/invitation-repository';

export const CONTRACT_ADMIN_ID = 'u-admin';
export const CONTRACT_CLAIMER_ID = 'u-claimer';
export const CONTRACT_RESIDENT_A = 'r-a';
export const CONTRACT_RESIDENT_B = 'r-b';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 60_000);
const EARLIER = new Date(NOW.getTime() - 60_000);

interface ContractRepos {
  invitations: CondoInvitationRepository;
  tokens: InvitationTokenRepository;
}

function input(tokenHash: string, expiresAt: Date = LATER, email: string | null = 'a@x.com') {
  return {
    residentId: CONTRACT_RESIDENT_A,
    email,
    tokenHash,
    expiresAt,
    createdBy: CONTRACT_ADMIN_ID,
  };
}

function sindicoInput(tokenHash: string, expiresAt: Date = LATER) {
  return { email: 'sindica@x.com', tokenHash, expiresAt, createdBy: CONTRACT_ADMIN_ID };
}

export function runInvitationRepositoryContract(
  label: string,
  makeRepos: (condominiumId: string) => Promise<ContractRepos>,
): void {
  describe(label, () => {
    test('create stores a pending invitation that latestForResident returns', async () => {
      const { invitations } = await makeRepos('condo-a');

      const created = await invitations.create(input('h1'), NOW);

      expect(created).toMatchObject({
        condominiumId: 'condo-a',
        residentId: CONTRACT_RESIDENT_A,
        role: 'morador',
        email: 'a@x.com',
        status: 'pendente',
        createdBy: CONTRACT_ADMIN_ID,
        claimedBy: null,
        acceptedAt: null,
      });
      expect(created.expiresAt).toEqual(LATER);
      expect(await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW)).toEqual(created);
    });

    test('keeps a null e-mail', async () => {
      const { invitations } = await makeRepos('condo-a');

      const created = await invitations.create(input('h1', LATER, null), NOW);

      expect(created.email).toBeNull();
    });

    test('latestForResident is null when there is no invitation', async () => {
      const { invitations } = await makeRepos('condo-a');

      expect(await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW)).toBeNull();
    });

    test('create revokes the previous pending invitation and returns the newest', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');
      const first = await invitations.create(input('h1'), NOW);

      const second = await invitations.create(input('h2'), NOW);

      expect((await tokens.findByTokenHash('h1', NOW))?.status).toBe('revogado');
      expect((await tokens.findByTokenHash('h1', NOW))?.id).toBe(first.id);
      expect((await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW))?.id).toBe(second.id);
      expect(second.status).toBe('pendente');
    });

    test('derives expirado from expires_at', async () => {
      const { invitations } = await makeRepos('condo-a');
      await invitations.create(input('h1', EARLIER), NOW);

      expect((await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW))?.status).toBe(
        'expirado',
      );
    });

    test('revoke moves the pending invitation to revogado', async () => {
      const { invitations } = await makeRepos('condo-a');
      await invitations.create(input('h1'), NOW);

      await invitations.revoke(CONTRACT_RESIDENT_A);

      expect((await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW))?.status).toBe(
        'revogado',
      );
    });

    test('revoke without a pending invitation changes nothing', async () => {
      const { invitations } = await makeRepos('condo-a');

      await expect(invitations.revoke(CONTRACT_RESIDENT_A)).resolves.toBeUndefined();
      expect(await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW)).toBeNull();
    });

    test('create refuses a resident of another condominium', async () => {
      const { invitations } = await makeRepos('condo-a');

      await expect(
        invitations.create({ ...input('h1'), residentId: CONTRACT_RESIDENT_B }, NOW),
      ).rejects.toMatchObject({ status: 404 });
    });

    test('condominium A cannot see or revoke the invitations of condominium B', async () => {
      const a = await makeRepos('condo-a');
      const b = await makeRepos('condo-b');
      await b.invitations.create({ ...input('hb'), residentId: CONTRACT_RESIDENT_B }, NOW);

      await a.invitations.revoke(CONTRACT_RESIDENT_B);

      expect(await a.invitations.latestForResident(CONTRACT_RESIDENT_B, NOW)).toBeNull();
      expect((await b.invitations.latestForResident(CONTRACT_RESIDENT_B, NOW))?.status).toBe(
        'pendente',
      );
    });

    test('findByTokenHash finds across condominiums and misses unknown hashes', async () => {
      const b = await makeRepos('condo-b');
      const created = await b.invitations.create(
        { ...input('hb'), residentId: CONTRACT_RESIDENT_B },
        NOW,
      );

      const found = await b.tokens.findByTokenHash('hb', NOW);

      expect(found).toMatchObject({ id: created.id, condominiumId: 'condo-b' });
      expect(await b.tokens.findByTokenHash('ghost', NOW)).toBeNull();
    });

    test('claim sets claimed_by only once and only while pending', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');
      const created = await invitations.create(input('h1'), NOW);

      expect(await tokens.claim(created.id, CONTRACT_CLAIMER_ID)).toBe(true);
      expect(await tokens.claim(created.id, CONTRACT_ADMIN_ID)).toBe(false);
      expect((await tokens.findByTokenHash('h1', NOW))?.claimedBy).toBe(CONTRACT_CLAIMER_ID);

      await invitations.revoke(CONTRACT_RESIDENT_A);
      const next = await invitations.create(input('h2'), NOW);
      await invitations.revoke(CONTRACT_RESIDENT_A);
      expect(await tokens.claim(next.id, CONTRACT_CLAIMER_ID)).toBe(false);
    });

    test('accept moves a pending invitation claimed by that user to aceito only once', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');
      const created = await invitations.create(input('h1'), NOW);
      expect(await tokens.accept(created.id, CONTRACT_CLAIMER_ID, NOW)).toBe(false);
      await tokens.claim(created.id, CONTRACT_CLAIMER_ID);

      expect(await tokens.accept(created.id, CONTRACT_ADMIN_ID, NOW)).toBe(false);
      expect(await tokens.accept(created.id, CONTRACT_CLAIMER_ID, NOW)).toBe(true);
      expect(await tokens.accept(created.id, CONTRACT_CLAIMER_ID, NOW)).toBe(false);

      const accepted = await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW);
      expect(accepted?.status).toBe('aceito');
      expect(accepted?.acceptedAt).toEqual(NOW);
    });

    test('claimedBy lists only pending invitations claimed by that user', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');
      const created = await invitations.create(input('h1'), NOW);
      await tokens.claim(created.id, CONTRACT_CLAIMER_ID);

      expect((await tokens.claimedBy(CONTRACT_CLAIMER_ID, NOW)).map((i) => i.id)).toEqual([
        created.id,
      ]);
      expect(await tokens.claimedBy(CONTRACT_ADMIN_ID, NOW)).toEqual([]);

      await tokens.accept(created.id, CONTRACT_CLAIMER_ID, NOW);
      expect(await tokens.claimedBy(CONTRACT_CLAIMER_ID, NOW)).toEqual([]);
    });

    test('releaseClaims frees only the pending claims of that user', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');
      const b = await makeRepos('condo-b');
      const accepted = await b.invitations.create(
        { ...input('hb'), residentId: CONTRACT_RESIDENT_B },
        NOW,
      );
      await tokens.claim(accepted.id, CONTRACT_CLAIMER_ID);
      await tokens.accept(accepted.id, CONTRACT_CLAIMER_ID, NOW);
      const pending = await invitations.create(input('h1'), NOW);
      await tokens.claim(pending.id, CONTRACT_CLAIMER_ID);

      await tokens.releaseClaims(CONTRACT_CLAIMER_ID);

      expect((await tokens.findByTokenHash('h1', NOW))?.claimedBy).toBeNull();
      expect((await tokens.findByTokenHash('h1', NOW))?.status).toBe('pendente');
      expect((await tokens.findByTokenHash('hb', NOW))?.claimedBy).toBe(CONTRACT_CLAIMER_ID);
      expect(await tokens.claim(pending.id, CONTRACT_ADMIN_ID)).toBe(true);
    });

    test('createSindico stores a pending sindico invitation that latestSindico returns', async () => {
      const { invitations, tokens } = await makeRepos('condo-a');

      const created = await invitations.createSindico(sindicoInput('hs1'), NOW);

      expect(created).toMatchObject({
        condominiumId: 'condo-a',
        role: 'sindico',
        email: 'sindica@x.com',
        status: 'pendente',
        createdBy: CONTRACT_ADMIN_ID,
        claimedBy: null,
      });
      expect(created).not.toHaveProperty('residentId');
      expect(await invitations.latestSindico(NOW)).toEqual(created);
      expect(await tokens.findByTokenHash('hs1', NOW)).toEqual(created);
      expect(await invitations.latestForResident(CONTRACT_RESIDENT_A, NOW)).toBeNull();
    });

    test('createSindico revokes the previous pending sindico invitation of that condo only', async () => {
      const a = await makeRepos('condo-a');
      const b = await makeRepos('condo-b');
      await b.invitations.createSindico(sindicoInput('hsb'), NOW);
      await a.invitations.create(input('hm'), NOW);
      await a.invitations.createSindico(sindicoInput('hs1'), NOW);

      const second = await a.invitations.createSindico(sindicoInput('hs2'), NOW);

      expect((await a.tokens.findByTokenHash('hs1', NOW))?.status).toBe('revogado');
      expect((await a.invitations.latestSindico(NOW))?.id).toBe(second.id);
      expect((await b.invitations.latestSindico(NOW))?.status).toBe('pendente');
      expect((await a.tokens.findByTokenHash('hm', NOW))?.status).toBe('pendente');
    });

    test('revokeSindico revokes only the pending sindico invitation of that condo', async () => {
      const a = await makeRepos('condo-a');
      const b = await makeRepos('condo-b');
      await a.invitations.create(input('hm'), NOW);
      await a.invitations.createSindico(sindicoInput('hs1', EARLIER), NOW);
      expect((await a.invitations.latestSindico(NOW))?.status).toBe('expirado');
      await a.invitations.createSindico(sindicoInput('hs2'), NOW);
      await b.invitations.createSindico(sindicoInput('hsb'), NOW);

      await a.invitations.revokeSindico();

      expect((await a.invitations.latestSindico(NOW))?.status).toBe('revogado');
      expect((await b.invitations.latestSindico(NOW))?.status).toBe('pendente');
      expect((await a.tokens.findByTokenHash('hm', NOW))?.status).toBe('pendente');
    });

    test('createSindico refuses an unknown condominium', async () => {
      const { invitations } = await makeRepos('condo-ghost');

      await expect(invitations.createSindico(sindicoInput('hs'), NOW)).rejects.toMatchObject({
        status: 404,
      });
    });

    test('latestSindico is null without a sindico invitation', async () => {
      const { invitations } = await makeRepos('condo-a');
      await invitations.create(input('hm'), NOW);

      expect(await invitations.latestSindico(NOW)).toBeNull();
    });
  });
}

export const CONTRACT_ORG_ID = 'org-condo-a';
export const CONTRACT_OTHER_ORG_ID = 'org-condo-b';

function memberInput(tokenHash: string, email = 'equipe@x.com', expiresAt: Date = LATER) {
  return {
    organizationId: CONTRACT_ORG_ID,
    email,
    orgRole: 'member' as const,
    tokenHash,
    expiresAt,
    createdBy: CONTRACT_ADMIN_ID,
  };
}

export function runOrgInvitationRepositoryContract(
  label: string,
  makeRepo: () => Promise<OrgInvitationRepository>,
): void {
  describe(label, () => {
    test('create stores a pending membro invitation listed by pending', async () => {
      const repo = await makeRepo();

      const created = await repo.create(memberInput('hm1'), NOW);

      expect(created).toMatchObject({
        role: 'membro',
        organizationId: CONTRACT_ORG_ID,
        orgRole: 'member',
        email: 'equipe@x.com',
        status: 'pendente',
      });
      expect(await repo.pending(CONTRACT_ORG_ID, NOW)).toEqual([created]);
      expect(await repo.pending(CONTRACT_OTHER_ORG_ID, NOW)).toEqual([]);
    });

    test('creating again for the same e-mail revokes the previous one', async () => {
      const repo = await makeRepo();
      const first = await repo.create(memberInput('hm1'), NOW);
      const other = await repo.create(memberInput('hm2', 'outra@x.com'), NOW);

      const second = await repo.create(memberInput('hm3'), NOW);

      const pending = await repo.pending(CONTRACT_ORG_ID, NOW);
      expect(pending.map((i) => i.id).sort()).toEqual([other.id, second.id].sort());
      expect(pending.map((i) => i.id)).not.toContain(first.id);
    });

    test('pending leaves out expired invitations', async () => {
      const repo = await makeRepo();
      await repo.create(memberInput('hm1', 'velha@x.com', EARLIER), NOW);

      expect(await repo.pending(CONTRACT_ORG_ID, NOW)).toEqual([]);
    });

    test('create in an unknown organization fails', async () => {
      const repo = await makeRepo();

      await expect(
        repo.create({ ...memberInput('hm1'), organizationId: 'org-ghost' }, NOW),
      ).rejects.toMatchObject({ status: 404 });
    });

    test('revoke is scoped by organization and only touches a pending invitation', async () => {
      const repo = await makeRepo();
      const created = await repo.create(memberInput('hm1'), NOW);

      expect(await repo.revoke(CONTRACT_OTHER_ORG_ID, created.id)).toBe(false);
      expect(await repo.pending(CONTRACT_ORG_ID, NOW)).toHaveLength(1);
      expect(await repo.revoke(CONTRACT_ORG_ID, created.id)).toBe(true);
      expect(await repo.revoke(CONTRACT_ORG_ID, created.id)).toBe(false);
      expect(await repo.pending(CONTRACT_ORG_ID, NOW)).toEqual([]);
    });
  });
}
