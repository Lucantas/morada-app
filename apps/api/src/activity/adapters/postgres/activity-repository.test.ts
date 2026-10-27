import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runActivityRepositoryContract } from '../activity-repository.contract';

import { PostgresActivityRepository } from './activity-repository';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('PostgresActivityRepository — contract', () => {
  beforeEach(async () => {
    await resetPg(pool);
    await createTestCondo(pool, 'condo-a');
    await createTestCondo(pool, 'condo-b');
  });

  runActivityRepositoryContract(
    'PostgresActivityRepository',
    async (condominiumId) => new PostgresActivityRepository(pool, condominiumId),
    async (user) => {
      await pool.query(
        `INSERT INTO users (id, username, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'x', 'resident')`,
        [user.id, user.username ?? `login-${user.id}`, user.email, user.name],
      );
    },
  );

  test('latest skips rows whose action is unknown instead of failing', async () => {
    const repo = new PostgresActivityRepository(pool, 'condo-a');
    await pool.query(
      `INSERT INTO users (id, username, email, name, password_hash, role)
       VALUES ('u-1', 'ana', NULL, 'Ana', 'x', 'resident')`,
    );
    await repo.record({
      actorUserId: 'u-1',
      action: 'account.created',
      subjectId: 'acc-1',
      at: new Date('2026-05-01T10:00:00Z'),
    });
    await pool.query(
      `INSERT INTO activity_log (id, condominium_id, actor_user_id, action, subject_id, created_at)
       VALUES ('legacy-1', 'condo-a', 'u-1', 'acao.removida', NULL, '2026-05-02T10:00:00Z')`,
    );

    const entries = await repo.latest(10);

    expect(entries.map((e) => e.action)).toEqual(['account.created']);
  });
});
