import type { Pool } from 'pg';

import { createTestCondo } from '../../test-support/condos';
import { OrgCondoNotFoundError } from '../domain/errors';
import type { OrganizationRepository } from '../domain/organization-repository';

export interface OrganizationRepositoryHarness {
  repo: OrganizationRepository;
  pool: Pool;
}

const ORG = 'org-a';
const OTHER_ORG = 'org-b';

async function insertUser(pool: Pool, id: string, name: string | null = null): Promise<void> {
  await pool.query(
    "INSERT INTO users (id, username, name, email, password_hash, role) VALUES ($1, $1, $2, $3, 'x', 'admin')",
    [id, name, `${id}@x.com`],
  );
}

async function insertMembership(
  pool: Pool,
  organizationId: string,
  userId: string,
  role: 'owner' | 'member',
  active = true,
): Promise<void> {
  await pool.query(
    'INSERT INTO organization_members (id, organization_id, user_id, role, active) VALUES ($1, $2, $3, $4, $5)',
    [`om-${organizationId}-${userId}`, organizationId, userId, role, active],
  );
}

async function insertAdminGrant(
  pool: Pool,
  condominiumId: string,
  userId: string,
  active = true,
): Promise<void> {
  await pool.query(
    "INSERT INTO condo_roles (id, condominium_id, user_id, role, active) VALUES ($1, $2, $3, 'administrador', $4)",
    [`role-${condominiumId}-${userId}`, condominiumId, userId, active],
  );
}

async function activeAdminCondos(pool: Pool, userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ condominium_id: string }>(
    `SELECT condominium_id FROM condo_roles
     WHERE user_id = $1 AND role = 'administrador' AND active ORDER BY condominium_id`,
    [userId],
  );
  return rows.map((row) => row.condominium_id);
}

async function seed(pool: Pool): Promise<void> {
  await createTestCondo(pool, 'c-1', { orgId: ORG, name: 'Bloco 1' });
  await createTestCondo(pool, 'c-2', { orgId: ORG, name: 'Bloco 2' });
  await createTestCondo(pool, 'c-off', { orgId: ORG, name: 'Inativo' });
  await pool.query("UPDATE condominiums SET active = FALSE WHERE id = 'c-off'");
  await createTestCondo(pool, 'c-x', { orgId: OTHER_ORG, name: 'Outro' });
  await insertUser(pool, 'u-owner', 'Dona');
  await insertUser(pool, 'u-member', 'Membro');
  await insertUser(pool, 'u-gone', 'Saiu');
  await insertUser(pool, 'u-out', 'Fora');
  await insertMembership(pool, ORG, 'u-owner', 'owner');
  await insertMembership(pool, ORG, 'u-member', 'member');
  await insertMembership(pool, ORG, 'u-gone', 'member', false);
  await insertMembership(pool, OTHER_ORG, 'u-out', 'owner');
}

export function runOrganizationRepositoryContract(
  label: string,
  makeRepo: () => Promise<OrganizationRepositoryHarness>,
): void {
  describe(label, () => {
    async function seeded(): Promise<OrganizationRepositoryHarness> {
      const harness = await makeRepo();
      await seed(harness.pool);
      return harness;
    }

    test('isActiveOwner is true only for an active owner of an active organization', async () => {
      const { repo, pool } = await seeded();

      expect(await repo.isActiveOwner(ORG, 'u-owner')).toBe(true);
      expect(await repo.isActiveOwner(ORG, 'u-member')).toBe(false);
      expect(await repo.isActiveOwner(ORG, 'u-out')).toBe(false);
      expect(await repo.isActiveOwner('org-ghost', 'u-owner')).toBe(false);
      await pool.query(`UPDATE organizations SET active = FALSE WHERE id = '${ORG}'`);
      expect(await repo.isActiveOwner(ORG, 'u-owner')).toBe(false);
    });

    test('get and rename the organization', async () => {
      const { repo } = await seeded();

      expect(await repo.rename(ORG, 'Nova Equipe')).toEqual({ id: ORG, name: 'Nova Equipe' });
      expect(await repo.get(ORG)).toEqual({ id: ORG, name: 'Nova Equipe' });
      expect(await repo.get('org-ghost')).toBeNull();
      expect(await repo.get(OTHER_ORG)).toEqual({
        id: OTHER_ORG,
        name: `Organização ${OTHER_ORG}`,
      });
    });

    test('condos lists the active condominiums of the organization only', async () => {
      const { repo } = await seeded();

      expect(await repo.condos(ORG)).toEqual([
        { id: 'c-1', name: 'Bloco 1' },
        { id: 'c-2', name: 'Bloco 2' },
      ]);
    });

    test('members lists condoIds of active administrador grants only', async () => {
      const { repo, pool } = await seeded();
      await insertAdminGrant(pool, 'c-1', 'u-member');
      await insertAdminGrant(pool, 'c-2', 'u-member', false);
      await insertAdminGrant(pool, 'c-x', 'u-member');
      await pool.query(
        "INSERT INTO condo_roles (id, condominium_id, user_id, role) VALUES ('role-s', 'c-2', 'u-member', 'sindico')",
      );

      expect(await repo.members(ORG)).toEqual([
        {
          userId: 'u-owner',
          name: 'Dona',
          email: 'u-owner@x.com',
          role: 'owner',
          active: true,
          condoIds: [],
        },
        {
          userId: 'u-member',
          name: 'Membro',
          email: 'u-member@x.com',
          role: 'member',
          active: true,
          condoIds: ['c-1'],
        },
        {
          userId: 'u-gone',
          name: 'Saiu',
          email: 'u-gone@x.com',
          role: 'member',
          active: false,
          condoIds: [],
        },
      ]);
    });

    test('member reads the membership of the organization only', async () => {
      const { repo } = await seeded();

      expect(await repo.member(ORG, 'u-member')).toEqual({ role: 'member', active: true });
      expect(await repo.member(ORG, 'u-gone')).toEqual({ role: 'member', active: false });
      expect(await repo.member(ORG, 'u-out')).toBeNull();
    });

    test('deactivateMember flips the membership and its administrador grants of the organization', async () => {
      const { repo, pool } = await seeded();
      await insertAdminGrant(pool, 'c-1', 'u-member');
      await insertAdminGrant(pool, 'c-x', 'u-member');

      await repo.deactivateMember(ORG, 'u-member');

      expect(await repo.member(ORG, 'u-member')).toEqual({ role: 'member', active: false });
      expect(await activeAdminCondos(pool, 'u-member')).toEqual(['c-x']);
    });

    test('assignCondos grants exactly the given condominiums and deactivates the rest', async () => {
      const { repo, pool } = await seeded();
      await insertAdminGrant(pool, 'c-1', 'u-member');
      await insertAdminGrant(pool, 'c-x', 'u-member');

      expect(await repo.assignCondos(ORG, 'u-member', ['c-2', 'c-2'])).toEqual(['c-2']);
      expect(await activeAdminCondos(pool, 'u-member')).toEqual(['c-2', 'c-x']);

      expect(await repo.assignCondos(ORG, 'u-member', ['c-1', 'c-2'])).toEqual(['c-1', 'c-2']);
      expect(await activeAdminCondos(pool, 'u-member')).toEqual(['c-1', 'c-2', 'c-x']);

      expect(await repo.assignCondos(ORG, 'u-member', [])).toEqual([]);
      expect(await activeAdminCondos(pool, 'u-member')).toEqual(['c-x']);
    });

    test('assignCondos with a condominium outside the organization writes nothing', async () => {
      const { repo, pool } = await seeded();
      await insertAdminGrant(pool, 'c-1', 'u-member');

      for (const outside of ['c-x', 'c-off', 'c-ghost']) {
        await expect(repo.assignCondos(ORG, 'u-member', ['c-2', outside])).rejects.toBeInstanceOf(
          OrgCondoNotFoundError,
        );
      }
      expect(await activeAdminCondos(pool, 'u-member')).toEqual(['c-1']);
    });
  });
}
