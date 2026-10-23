import { PostgresCondoRepository } from '../../condos/adapters/postgres/condo-repository';
import { DisabledEmailSender, type EmailSender } from '../../platform/email/email-sender';
import { InMemoryEmailSender } from '../../platform/email/in-memory-email-sender';
import { migrate } from '../../platform/postgres/migrate';
import { createPool } from '../../platform/postgres/pool';
import { hashToken } from '../../platform/tokens';
import { createTestCondo } from '../../test-support/condos';
import { resetPg } from '../../test-support/pg';
import {
  PostgresInvitationRepository,
  PostgresInvitationTokenRepository,
} from '../adapters/postgres/invitation-repository';

import { createSindicoInvitation } from './create-sindico-invitation';

const pool = createPool(process.env.DATABASE_URL ?? '');
const NOW = new Date('2026-10-23T12:00:00.000Z');
const APP_URL = 'https://app.test';

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await resetPg(pool);
  await createTestCondo(pool, 'condo-a', { name: 'Morada Bloco 2' });
  await pool.query(
    "INSERT INTO users (id, username, password_hash, role) VALUES ('u-admin', 'u-admin', 'x', 'admin')",
  );
});

function deps(email: EmailSender = new InMemoryEmailSender(), condominiumId = 'condo-a') {
  return {
    invitations: new PostgresInvitationRepository(pool, condominiumId),
    condos: new PostgresCondoRepository(pool),
    email,
    appUrl: APP_URL,
    now: () => NOW,
  };
}

const tokenOf = (link: string) => link.slice(`${APP_URL}/#/convite/`.length);

async function statuses(): Promise<string[]> {
  const { rows } = await pool.query<{ status: string }>(
    'SELECT status FROM invitations ORDER BY status',
  );
  return rows.map((row) => row.status);
}

describe('createSindicoInvitation', () => {
  test.each([[{}], [{ email: '   ' }], [{ email: 'nao-e-email' }], [undefined]])(
    'rejects a missing e-mail: %j',
    async (body) => {
      await expect(
        createSindicoInvitation(deps(), 'condo-a', 'u-admin', body),
      ).rejects.toMatchObject({ name: 'ZodError' });
      expect(await statuses()).toEqual([]);
    },
  );

  test('creates a pending invite, e-mails the link and returns it with the WhatsApp url', async () => {
    const sender = new InMemoryEmailSender();

    const created = await createSindicoInvitation(deps(sender), 'condo-a', 'u-admin', {
      email: ' Sindica@X.com ',
      phone: '(11) 98888-7777',
    });

    expect(created).toMatchObject({ status: 'pendente', email: 'sindica@x.com', emailSent: true });
    expect(created.expiresAt).toEqual(new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000));
    expect(created.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    expect(decodeURIComponent(created.whatsappUrl)).toContain('para ser síndico do Morada Bloco 2');
    expect(sender.lastTo('sindica@x.com')?.subject).toBe(
      'Você foi convidado para ser síndico do Morada Bloco 2',
    );
    const found = await new PostgresInvitationTokenRepository(pool).findByTokenHash(
      hashToken(tokenOf(created.link)),
      NOW,
    );
    expect(found).toMatchObject({
      role: 'sindico',
      condominiumId: 'condo-a',
      createdBy: 'u-admin',
    });
  });

  test('reenviar revokes the previous pending invite', async () => {
    const first = await createSindicoInvitation(deps(), 'condo-a', 'u-admin', {
      email: 'a@x.com',
    });

    await createSindicoInvitation(deps(), 'condo-a', 'u-admin', { email: 'b@x.com' });

    expect(await statuses()).toEqual(['pendente', 'revogado']);
    const old = await new PostgresInvitationTokenRepository(pool).findByTokenHash(
      hashToken(tokenOf(first.link)),
      NOW,
    );
    expect(old?.status).toBe('revogado');
  });

  test('with e-mail off it still answers the link, with emailSent false', async () => {
    const created = await createSindicoInvitation(
      deps(new DisabledEmailSender()),
      'condo-a',
      'u-admin',
      { email: 'a@x.com' },
    );

    expect(created.emailSent).toBe(false);
    expect(created.whatsappUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  test('an unknown condominium answers 404 and writes nothing', async () => {
    await expect(
      createSindicoInvitation(deps(undefined, 'condo-ghost'), 'condo-ghost', 'u-admin', {
        email: 'a@x.com',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await statuses()).toEqual([]);
  });
});
