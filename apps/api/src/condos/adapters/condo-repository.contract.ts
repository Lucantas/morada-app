import type { Pool } from 'pg';

import { createTestCondo } from '../../test-support/condos';
import { CondoGrantValidationError, CondoNotFoundError } from '../domain/errors';
import type { CondoRepository } from '../domain/condo-repository';

export interface CondoRepositoryHarness {
  repo: CondoRepository;
  pool: Pool;
}

async function insertUser(pool: Pool, id: string): Promise<void> {
  await pool.query(
    "INSERT INTO users (id, username, password_hash, role, resident_id) VALUES ($1, $1, 'x', 'admin', NULL)",
    [id],
  );
}

async function count(pool: Pool, from: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${from}`);
  return rows[0]?.n ?? -1;
}

async function insertMembership(
  pool: Pool,
  organizationId: string,
  userId: string,
  role: 'owner' | 'member',
): Promise<void> {
  await pool.query(
    'INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)',
    [`om-${organizationId}-${userId}`, organizationId, userId, role],
  );
}

async function insertOccupiedResident(
  pool: Pool,
  condominiumId: string,
  residentId: string,
): Promise<void> {
  await pool.query('INSERT INTO apartments (id, label, condominium_id) VALUES ($1, $2, $3)', [
    `apt-${residentId}`,
    `Apto ${residentId}`,
    condominiumId,
  ]);
  await pool.query(
    "INSERT INTO residents (id, name, phone, email, status, condominium_id) VALUES ($1, 'Lúcia', '9', 'l@x.y', 'em_dia', $2)",
    [residentId, condominiumId],
  );
  await pool.query(
    'INSERT INTO apartment_residents (id, apartment_id, resident_id, active) VALUES ($1, $2, $3, TRUE)',
    [`occ-${residentId}`, `apt-${residentId}`, residentId],
  );
}

export function runCondoRepositoryContract(
  label: string,
  makeRepo: () => Promise<CondoRepositoryHarness>,
): void {
  describe(label, () => {
    test('create inserts settings and default categories for the new condo', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });

      const condo = await repo.create({
        organizationId: org.id,
        name: 'Residencial Ipê',
        monthlyFeeCents: 32000,
        dueDay: 10,
      });

      expect(condo).toMatchObject({
        organizationId: org.id,
        name: 'Residencial Ipê',
        active: true,
      });
      expect(await repo.getById(condo.id)).toEqual(condo);
      const settings = await pool.query(
        'SELECT monthly_fee_cents, due_day FROM condo_settings WHERE condominium_id = $1',
        [condo.id],
      );
      expect(settings.rows).toEqual([{ monthly_fee_cents: 32000, due_day: 10 }]);
      const categories = await pool.query(
        'SELECT id, name, keywords, position FROM categories WHERE condominium_id = $1 ORDER BY position',
        [condo.id],
      );
      expect(categories.rows.map((row) => row.name)).toEqual([
        'Água',
        'Energia',
        'Serviços',
        'Manutenção',
      ]);
      expect(categories.rows.map((row) => row.position)).toEqual([0, 1, 2, 3]);
      expect(categories.rows[0]?.keywords).toBe('água, agua, saneamento, esgoto');
      expect(new Set(categories.rows.map((row) => row.id)).size).toBe(4);
    });

    test('listForUser returns only condos with an active role', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await createTestCondo(pool, 'condo-b', { name: 'B' });
      await createTestCondo(pool, 'condo-c', { name: 'C' });
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'sindico',
        residentId: null,
      });
      await repo.grant({
        condominiumId: 'condo-b',
        userId: 'u-1',
        role: 'administrador',
        residentId: null,
      });
      await pool.query("UPDATE condo_roles SET active = FALSE WHERE condominium_id = 'condo-b'");

      expect(await repo.listForUser('u-1')).toEqual([
        {
          condominiumId: 'condo-a',
          name: 'A',
          role: 'sindico',
          residentId: null,
          organizationId: 'org-condo-a',
          orgRole: null,
        },
      ]);
    });

    test('org owner sees every active condo of the org as administrador', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });
      const ipe = await repo.create({
        organizationId: org.id,
        name: 'Ipê',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      const aurora = await repo.create({
        organizationId: org.id,
        name: 'Aurora',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      await createTestCondo(pool, 'condo-other', { name: 'Outro' });

      const list = await repo.listForUser('u-owner');

      expect(list).toEqual([
        {
          condominiumId: aurora.id,
          name: 'Aurora',
          role: 'administrador',
          residentId: null,
          organizationId: org.id,
          orgRole: 'owner',
        },
        {
          condominiumId: ipe.id,
          name: 'Ipê',
          role: 'administrador',
          residentId: null,
          organizationId: org.id,
          orgRole: 'owner',
        },
      ]);
      expect(await repo.accessFor('u-owner', 'condo-other')).toBeNull();
    });

    test('inactive condo is never listed nor accessible', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      await insertUser(pool, 'u-1');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });
      const condo = await repo.create({
        organizationId: org.id,
        name: 'Ipê',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      await repo.grant({
        condominiumId: condo.id,
        userId: 'u-1',
        role: 'administrador',
        residentId: null,
      });
      await pool.query('UPDATE condominiums SET active = FALSE WHERE id = $1', [condo.id]);

      expect(await repo.listForUser('u-owner')).toEqual([]);
      expect(await repo.listForUser('u-1')).toEqual([]);
      expect(await repo.accessFor('u-owner', condo.id)).toBeNull();
      expect(await repo.accessFor('u-1', condo.id)).toBeNull();
    });

    test('inactive org membership grants nothing', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });
      const condo = await repo.create({
        organizationId: org.id,
        name: 'Ipê',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      await pool.query("UPDATE organization_members SET active = FALSE WHERE user_id = 'u-owner'");

      expect(await repo.accessFor('u-owner', condo.id)).toBeNull();
    });

    test('accessFor returns null for a condo the user has no role in', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');
      await createTestCondo(pool, 'condo-b');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'administrador',
        residentId: null,
      });

      expect(await repo.accessFor('u-1', 'condo-b')).toBeNull();
      expect(await repo.accessFor('u-1', 'condo-missing')).toBeNull();
    });

    test('accessFor returns null for a morador whose occupancy was deactivated', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-lucia');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await insertOccupiedResident(pool, 'condo-a', 'r-lucia');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-lucia',
        role: 'morador',
        residentId: 'r-lucia',
      });
      expect(await repo.accessFor('u-lucia', 'condo-a')).toEqual({
        condominiumId: 'condo-a',
        name: 'A',
        role: 'morador',
        residentId: 'r-lucia',
        organizationId: 'org-condo-a',
        orgRole: null,
      });

      await pool.query("UPDATE apartment_residents SET active = FALSE WHERE id = 'occ-r-lucia'");

      expect(await repo.accessFor('u-lucia', 'condo-a')).toBeNull();
      expect(await repo.listForUser('u-lucia')).toEqual([]);
    });

    test('a stored morador row without a linked resident has no access', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');
      await pool.query(
        "INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id) VALUES ('cr-1', 'condo-a', 'u-1', 'morador', NULL)",
      );

      expect(await repo.accessFor('u-1', 'condo-a')).toBeNull();
    });

    test('highest role wins when a user is sindico and morador', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await insertOccupiedResident(pool, 'condo-a', 'r-1');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'morador',
        residentId: 'r-1',
      });
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'sindico',
        residentId: null,
      });

      const expected = {
        condominiumId: 'condo-a',
        name: 'A',
        role: 'sindico',
        residentId: 'r-1',
        organizationId: 'org-condo-a',
        orgRole: null,
      };
      expect(await repo.accessFor('u-1', 'condo-a')).toEqual(expected);
      expect(await repo.listForUser('u-1')).toEqual([expected]);
    });

    test('grant is idempotent and reactivates', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      const grant = {
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'administrador' as const,
        residentId: null,
      };
      await insertMembership(pool, 'org-condo-a', 'u-1', 'member');
      await repo.grant(grant);
      await repo.grant(grant);
      await pool.query('UPDATE condo_roles SET active = FALSE');
      expect(await repo.accessFor('u-1', 'condo-a')).toBeNull();

      await repo.grant(grant);

      const { rows } = await pool.query('SELECT active FROM condo_roles');
      expect(rows).toEqual([{ active: true }]);
      expect((await repo.accessFor('u-1', 'condo-a'))?.role).toBe('administrador');
    });

    test('deactivateResidentGrants retires the other grants of that resident in that condo only', async () => {
      const { repo, pool } = await makeRepo();
      for (const id of ['u-legacy', 'u-new', 'u-neighbor']) await insertUser(pool, id);
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await createTestCondo(pool, 'condo-b', { name: 'B' });
      await insertOccupiedResident(pool, 'condo-a', 'r-1');
      await insertOccupiedResident(pool, 'condo-a', 'r-2');
      await insertOccupiedResident(pool, 'condo-b', 'r-b');
      const morador = (condominiumId: string, userId: string, residentId: string) =>
        repo.grant({ condominiumId, userId, role: 'morador', residentId });
      await morador('condo-a', 'u-legacy', 'r-1');
      await morador('condo-a', 'u-new', 'r-1');
      await morador('condo-a', 'u-neighbor', 'r-2');
      await morador('condo-b', 'u-legacy', 'r-b');
      await pool.query(
        "INSERT INTO condo_roles (id, condominium_id, user_id, role, resident_id) VALUES ('cr-odd', 'condo-a', 'u-neighbor', 'sindico', 'r-1')",
      );

      await repo.deactivateResidentGrants('condo-a', 'r-1', 'u-new');

      const { rows } = await pool.query(
        'SELECT condominium_id, user_id, role, active FROM condo_roles ORDER BY condominium_id, user_id, role',
      );
      expect(rows).toEqual([
        { condominium_id: 'condo-a', user_id: 'u-legacy', role: 'morador', active: false },
        { condominium_id: 'condo-a', user_id: 'u-neighbor', role: 'morador', active: true },
        { condominium_id: 'condo-a', user_id: 'u-neighbor', role: 'sindico', active: true },
        { condominium_id: 'condo-a', user_id: 'u-new', role: 'morador', active: true },
        { condominium_id: 'condo-b', user_id: 'u-legacy', role: 'morador', active: true },
      ]);
      expect(await repo.accessFor('u-legacy', 'condo-a')).toBeNull();
      expect((await repo.accessFor('u-new', 'condo-a'))?.residentId).toBe('r-1');
    });

    test('morador whose resident lives in another condo has no access', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');
      await createTestCondo(pool, 'condo-b');
      await insertOccupiedResident(pool, 'condo-b', 'r-1');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'morador',
        residentId: 'r-1',
      });

      expect(await repo.accessFor('u-1', 'condo-a')).toBeNull();
      expect(await repo.listForUser('u-1')).toEqual([]);
    });

    test('administrador role with an org membership grants access, member or owner', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-member');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await insertMembership(pool, 'org-condo-a', 'u-member', 'member');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-member',
        role: 'administrador',
        residentId: null,
      });

      expect(await repo.accessFor('u-member', 'condo-a')).toEqual({
        condominiumId: 'condo-a',
        name: 'A',
        role: 'administrador',
        residentId: null,
        organizationId: 'org-condo-a',
        orgRole: 'member',
      });
    });

    test('a morador grant carries the active org membership role', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a', { name: 'A' });
      await insertOccupiedResident(pool, 'condo-a', 'r-1');
      await insertMembership(pool, 'org-condo-a', 'u-1', 'member');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'morador',
        residentId: 'r-1',
      });
      expect((await repo.accessFor('u-1', 'condo-a'))?.orgRole).toBe('member');

      await pool.query("UPDATE organization_members SET active = FALSE WHERE user_id = 'u-1'");

      expect(await repo.accessFor('u-1', 'condo-a')).toMatchObject({
        role: 'morador',
        orgRole: null,
      });
    });

    test('administrador role without org membership grants nothing', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-1',
        role: 'administrador',
        residentId: null,
      });

      expect(await repo.accessFor('u-1', 'condo-a')).toBeNull();
      expect(await repo.listForUser('u-1')).toEqual([]);
    });

    test("deactivating an owner's org membership revokes access even with a condo_roles administrador row", async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });
      const condo = await repo.create({
        organizationId: org.id,
        name: 'Ipê',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      await repo.grant({
        condominiumId: condo.id,
        userId: 'u-owner',
        role: 'administrador',
        residentId: null,
      });
      expect((await repo.accessFor('u-owner', condo.id))?.role).toBe('administrador');

      await pool.query("UPDATE organization_members SET active = FALSE WHERE user_id = 'u-owner'");

      expect(await repo.accessFor('u-owner', condo.id)).toBeNull();
      expect(await repo.listForUser('u-owner')).toEqual([]);
    });

    test('inactive organization grants nothing', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      await insertUser(pool, 'u-sindico');
      await insertUser(pool, 'u-lucia');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });
      const condo = await repo.create({
        organizationId: org.id,
        name: 'Ipê',
        monthlyFeeCents: 1000,
        dueDay: 5,
      });
      await insertOccupiedResident(pool, condo.id, 'r-lucia');
      await repo.grant({
        condominiumId: condo.id,
        userId: 'u-owner',
        role: 'administrador',
        residentId: null,
      });
      await repo.grant({
        condominiumId: condo.id,
        userId: 'u-sindico',
        role: 'sindico',
        residentId: null,
      });
      await repo.grant({
        condominiumId: condo.id,
        userId: 'u-lucia',
        role: 'morador',
        residentId: 'r-lucia',
      });

      await pool.query('UPDATE organizations SET active = FALSE WHERE id = $1', [org.id]);

      for (const userId of ['u-owner', 'u-sindico', 'u-lucia']) {
        expect(await repo.accessFor(userId, condo.id)).toBeNull();
        expect(await repo.listForUser(userId)).toEqual([]);
      }
    });

    test('grant rejects a morador without a resident', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');

      const error = await repo
        .grant({ condominiumId: 'condo-a', userId: 'u-1', role: 'morador', residentId: null })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(CondoGrantValidationError);
      expect(error).toMatchObject({ status: 400 });
      const { rows } = await pool.query('SELECT id FROM condo_roles');
      expect(rows).toEqual([]);
    });

    test('grant rejects a resident on an administrador or sindico role', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-1');
      await createTestCondo(pool, 'condo-a');
      await insertOccupiedResident(pool, 'condo-a', 'r-1');

      for (const role of ['administrador', 'sindico'] as const) {
        await expect(
          repo.grant({ condominiumId: 'condo-a', userId: 'u-1', role, residentId: 'r-1' }),
        ).rejects.toThrow(CondoGrantValidationError);
      }
    });

    test('rename changes the name; rename of an unknown condo throws CondoNotFoundError', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a', { name: 'A' });

      const renamed = await repo.rename('condo-a', '  Residencial Novo ');

      expect(renamed).toMatchObject({ id: 'condo-a', name: 'Residencial Novo', active: true });
      expect((await repo.getById('condo-a'))?.name).toBe('Residencial Novo');
      const error = await repo.rename('condo-missing', 'X').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CondoNotFoundError);
      expect(error).toMatchObject({ status: 404, message: 'Condomínio não encontrado' });
    });

    test('isOperational requires an active condominium in an active organization', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a', { orgId: 'org-a' });
      await createTestCondo(pool, 'condo-b', { orgId: 'org-b' });
      await createTestCondo(pool, 'condo-c', { orgId: 'org-c' });
      await pool.query("UPDATE condominiums SET active = FALSE WHERE id = 'condo-b'");
      await pool.query("UPDATE organizations SET active = FALSE WHERE id = 'org-c'");

      expect(await repo.isOperational('condo-a')).toBe(true);
      expect(await repo.isOperational('condo-b')).toBe(false);
      expect(await repo.isOperational('condo-c')).toBe(false);
      expect(await repo.isOperational('condo-missing')).toBe(false);
    });

    test('ownedOrganization returns the first active organization the user owns', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      await insertUser(pool, 'u-other');
      const first = await repo.createOrganization({ name: 'Primeira', ownerUserId: 'u-owner' });
      await repo.createOrganization({ name: 'Segunda', ownerUserId: 'u-owner' });
      await repo.createOrganization({ name: 'Alheia', ownerUserId: 'u-other' });

      expect(await repo.ownedOrganization('u-owner')).toEqual({ id: first.id });
      expect(await repo.ownedOrganization('u-nobody')).toBeNull();
    });

    test('ownedOrganization ignores members, inactive memberships and inactive organizations', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      await insertUser(pool, 'u-member');
      const orgA = await repo.createOrganization({ name: 'A', ownerUserId: 'u-owner' });
      await insertMembership(pool, orgA.id, 'u-member', 'member');
      expect(await repo.ownedOrganization('u-member')).toBeNull();

      await pool.query("UPDATE organization_members SET active = FALSE WHERE user_id = 'u-owner'");
      expect(await repo.ownedOrganization('u-owner')).toBeNull();

      await pool.query("UPDATE organization_members SET active = TRUE WHERE user_id = 'u-owner'");
      await pool.query('UPDATE organizations SET active = FALSE WHERE id = $1', [orgA.id]);
      expect(await repo.ownedOrganization('u-owner')).toBeNull();
    });

    test('getById returns null when missing', async () => {
      const { repo } = await makeRepo();
      expect(await repo.getById('condo-missing')).toBeNull();
    });

    test('grantSindico leaves exactly one active sindico, the given user, in that condo only', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a');
      await createTestCondo(pool, 'condo-b');
      for (const id of ['u-old', 'u-new', 'u-other']) await insertUser(pool, id);
      await repo.grantSindico('condo-a', 'u-old');
      await repo.grantSindico('condo-b', 'u-other');
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-old',
        role: 'administrador',
        residentId: null,
      });

      await repo.grantSindico('condo-a', 'u-new');

      const { rows } = await pool.query(
        'SELECT condominium_id, user_id, role, resident_id, active FROM condo_roles ORDER BY condominium_id, user_id, role',
      );
      expect(rows).toEqual([
        {
          condominium_id: 'condo-a',
          user_id: 'u-new',
          role: 'sindico',
          resident_id: null,
          active: true,
        },
        {
          condominium_id: 'condo-a',
          user_id: 'u-old',
          role: 'administrador',
          resident_id: null,
          active: true,
        },
        {
          condominium_id: 'condo-a',
          user_id: 'u-old',
          role: 'sindico',
          resident_id: null,
          active: false,
        },
        {
          condominium_id: 'condo-b',
          user_id: 'u-other',
          role: 'sindico',
          resident_id: null,
          active: true,
        },
      ]);
    });

    test('grantSindico reactivates a retired sindico and retires the replacement', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a');
      for (const id of ['u-a', 'u-b']) await insertUser(pool, id);
      await repo.grantSindico('condo-a', 'u-a');
      await repo.grantSindico('condo-a', 'u-b');

      await repo.grantSindico('condo-a', 'u-a');

      expect((await repo.currentSindico('condo-a'))?.userId).toBe('u-a');
      expect(await count(pool, "condo_roles WHERE role = 'sindico' AND active")).toBe(1);
      expect(await count(pool, "condo_roles WHERE role = 'sindico'")).toBe(2);
    });

    test('grantSindico changes nothing when the statement fails', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a');
      await insertUser(pool, 'u-a');
      await repo.grantSindico('condo-a', 'u-a');

      await expect(repo.grantSindico('condo-a', 'u-ghost')).rejects.toBeDefined();

      expect((await repo.currentSindico('condo-a'))?.userId).toBe('u-a');
    });

    test('currentSindico returns the active sindico of that condo only', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a');
      await createTestCondo(pool, 'condo-b');
      await insertUser(pool, 'u-sindico');
      await pool.query(
        "UPDATE users SET name = 'Síndica', email = 'sindica@x.com' WHERE id = 'u-sindico'",
      );
      expect(await repo.currentSindico('condo-a')).toBeNull();

      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-sindico',
        role: 'sindico',
        residentId: null,
      });

      expect(await repo.currentSindico('condo-a')).toEqual({
        userId: 'u-sindico',
        name: 'Síndica',
        email: 'sindica@x.com',
      });
      expect(await repo.currentSindico('condo-b')).toBeNull();
    });

    test('removeSindico deactivates the sindico grant of that condo only, keeping the row', async () => {
      const { repo, pool } = await makeRepo();
      await createTestCondo(pool, 'condo-a');
      await createTestCondo(pool, 'condo-b');
      await insertUser(pool, 'u-sindico');
      await insertOccupiedResident(pool, 'condo-a', 'r-home');
      for (const condominiumId of ['condo-a', 'condo-b']) {
        await repo.grant({ condominiumId, userId: 'u-sindico', role: 'sindico', residentId: null });
      }
      await repo.grant({
        condominiumId: 'condo-a',
        userId: 'u-sindico',
        role: 'morador',
        residentId: 'r-home',
      });

      await repo.removeSindico('condo-a');

      expect(await repo.currentSindico('condo-a')).toBeNull();
      expect((await repo.currentSindico('condo-b'))?.userId).toBe('u-sindico');
      expect((await repo.accessFor('u-sindico', 'condo-a'))?.role).toBe('morador');
      expect(await count(pool, "condo_roles WHERE role = 'sindico'")).toBe(2);
    });

    test('addOrgMember adds a membership and reactivates an inactive one with the invited role', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      await insertUser(pool, 'u-member');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });

      await repo.addOrgMember(org.id, 'u-member', 'member');
      await repo.addOrgMember(org.id, 'u-member', 'member');
      await pool.query("UPDATE organization_members SET active = FALSE WHERE user_id = 'u-member'");
      await repo.addOrgMember(org.id, 'u-member', 'owner');

      const { rows } = await pool.query(
        "SELECT role, active FROM organization_members WHERE user_id = 'u-member'",
      );
      expect(rows).toEqual([{ role: 'owner', active: true }]);
    });

    test('addOrgMember never demotes an active owner', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });

      await repo.addOrgMember(org.id, 'u-owner', 'member');

      expect(await repo.ownedOrganization('u-owner')).toEqual({ id: org.id });
    });

    test('getOrganization returns an active organization only', async () => {
      const { repo, pool } = await makeRepo();
      await insertUser(pool, 'u-owner');
      const org = await repo.createOrganization({ name: 'Contábil', ownerUserId: 'u-owner' });

      expect(await repo.getOrganization(org.id)).toEqual({ id: org.id, name: 'Contábil' });
      await pool.query('UPDATE organizations SET active = FALSE WHERE id = $1', [org.id]);
      expect(await repo.getOrganization(org.id)).toBeNull();
      expect(await repo.getOrganization('org-missing')).toBeNull();
    });
  });
}
