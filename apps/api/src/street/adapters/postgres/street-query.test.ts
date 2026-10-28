import { randomUUID } from 'node:crypto';

import { migrate } from '../../../platform/postgres/migrate';
import { createPool } from '../../../platform/postgres/pool';
import { createTestCondo } from '../../../test-support/condos';
import { resetPg } from '../../../test-support/pg';
import { runStreetQueryContract, type StreetSeed } from '../street-query.contract';

import { PostgresStreetQuery } from './street-query';

const pool = createPool(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetPg(pool);
  await createTestCondo(pool, 'condo-a');
  await createTestCondo(pool, 'condo-b');
});

const seed: StreetSeed = {
  apartment: async (condoId, id, placement, active = true) => {
    await pool.query(
      `INSERT INTO apartments (id, label, condominium_id, block, floor, position, active)
       VALUES ($1, $1, $2, $3, $4, $5, $6)`,
      [id, condoId, placement.block, placement.floor, placement.position, active],
    );
  },
  resident: async (condoId, id, opts) => {
    await pool.query(
      `INSERT INTO residents (id, name, phone, email, status, status_override, condominium_id)
       VALUES ($1, 'Morador', '', '', 'em_dia', $2, $3)`,
      [id, opts.override, condoId],
    );
    if (opts.apartmentId) {
      await pool.query(
        'INSERT INTO apartment_residents (id, apartment_id, resident_id, active) VALUES ($1, $2, $3, $4)',
        [randomUUID(), opts.apartmentId, id, opts.occupancyActive ?? true],
      );
    }
  },
  receipt: async (condoId, residentId, status, dueDate) => {
    await pool.query(
      `INSERT INTO receipts (id, ref, title, value_cents, status, resident_id, due_date, condominium_id)
       VALUES ($1, 'ref', 'Taxa', 15000, $2, $3, $4, $5)`,
      [randomUUID(), status, residentId, dueDate, condoId],
    );
  },
  account: async (condoId, status, dueDate, visible = true) => {
    await pool.query(
      `INSERT INTO accounts (id, description, category, value_cents, status, due_date, visible, condominium_id)
       VALUES ($1, 'Conta', 'Água', 1000, $2, $3, $4, $5)`,
      [randomUUID(), status, dueDate, visible, condoId],
    );
  },
  thread: async (condoId, residentMessageAt) => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO threads (id, resident_name, apt, unread, messages, resident_message_at, condominium_id)
       VALUES ($1, 'Morador', 'Apto 1', FALSE, '[]', $2, $3)`,
      [id, residentMessageAt, condoId],
    );
    return id;
  },
  user: async (id) => {
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role) VALUES ($1, $1, 'x', 'admin')`,
      [id],
    );
  },
  markRead: async (threadId, userId, condoId, readAt) => {
    await pool.query(
      'INSERT INTO thread_reads (thread_id, user_id, condominium_id, read_at) VALUES ($1, $2, $3, $4)',
      [threadId, userId, condoId, readAt],
    );
  },
};

runStreetQueryContract('PostgresStreetQuery', async () => new PostgresStreetQuery(pool), seed);
