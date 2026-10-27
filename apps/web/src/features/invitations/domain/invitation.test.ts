import {
  acceptMode,
  buildAcceptInput,
  createdInvitationSchema,
  formatDayMonth,
  invitationPreviewSchema,
  invitationViewSchema,
  sindicoViewSchema,
  validateInviteEmail,
  validateSindicoEmail,
} from './invitation';

const EMPTY_FORM = { email: '', name: '', password: '', confirmation: '' };

describe('invitation schemas', () => {
  test('parses an invitation status view', () => {
    expect(
      invitationViewSchema.parse({
        status: 'pendente',
        email: null,
        expiresAt: '2026-10-30T15:00:00.000Z',
      }),
    ).toEqual({ status: 'pendente', email: null, expiresAt: '2026-10-30T15:00:00.000Z' });
  });

  test('rejects an unknown status', () => {
    expect(() =>
      invitationViewSchema.parse({ status: 'x', email: null, expiresAt: '2026-10-30T15:00:00Z' }),
    ).toThrow();
  });

  test('a created invitation carries the link and the WhatsApp URL', () => {
    const created = createdInvitationSchema.parse({
      status: 'pendente',
      email: 'ana@exemplo.com',
      expiresAt: '2026-10-30T15:00:00.000Z',
      link: 'https://morada.app/#/convite/abc',
      whatsappUrl: 'https://wa.me/5521999990000?text=oi',
      emailSent: false,
    });
    expect(created.link).toBe('https://morada.app/#/convite/abc');
    expect(created.emailSent).toBe(false);
  });

  test('parses a preview', () => {
    const preview = {
      role: 'morador',
      targetName: 'Morada',
      condoName: 'Morada',
      residentName: 'Ana',
      apt: 'Apto 302',
      email: null,
      accountExists: false,
    };
    expect(invitationPreviewSchema.parse(preview)).toEqual(preview);
  });
});

describe('invitation preview roles', () => {
  test('parses a team preview without condo or resident fields', () => {
    const preview = { role: 'membro', targetName: 'Aurora', email: 'a@b.com', accountExists: true };
    expect(invitationPreviewSchema.parse(preview)).toEqual(preview);
  });

  test('rejects an unknown role', () => {
    expect(() =>
      invitationPreviewSchema.parse({
        role: 'dono',
        targetName: 'x',
        email: null,
        accountExists: false,
      }),
    ).toThrow();
  });
});

describe('sindicoViewSchema', () => {
  test('parses an empty síndico view', () => {
    expect(sindicoViewSchema.parse({ current: null, invitation: null })).toEqual({
      current: null,
      invitation: null,
    });
  });

  test('parses a current síndico without a name', () => {
    const view = { current: { name: null, email: 'a@b.com' }, invitation: null };
    expect(sindicoViewSchema.parse(view)).toEqual(view);
  });
});

describe('validateSindicoEmail', () => {
  test('requires an e-mail', () => {
    expect(validateSindicoEmail('  ')).toEqual({
      ok: false,
      message: 'Informe o e-mail do síndico',
    });
  });

  test('rejects an invalid e-mail', () => {
    expect(validateSindicoEmail('x')).toEqual({ ok: false, message: 'Informe um e-mail válido.' });
  });

  test('normalizes a valid e-mail', () => {
    expect(validateSindicoEmail(' Ana@Exemplo.com ')).toEqual({
      ok: true,
      data: 'ana@exemplo.com',
    });
  });
});

describe('formatDayMonth', () => {
  test('formats an ISO timestamp as dd/mm', () => {
    expect(formatDayMonth('2026-03-05T15:00:00.000Z')).toBe('05/03');
  });
});

describe('validateInviteEmail', () => {
  test('an empty e-mail means a link-only invite', () => {
    expect(validateInviteEmail('  ')).toEqual({ ok: true, data: '' });
  });

  test('normalizes a typed e-mail', () => {
    expect(validateInviteEmail(' Ana@Exemplo.com ')).toEqual({
      ok: true,
      data: 'ana@exemplo.com',
    });
  });

  test('rejects an invalid e-mail', () => {
    expect(validateInviteEmail('ana')).toEqual({ ok: false, message: 'Informe um e-mail válido.' });
  });
});

describe('acceptMode', () => {
  const base = {
    role: 'morador' as const,
    targetName: 'Morada',
    condoName: 'Morada',
    residentName: 'Ana',
    apt: 'Apto 302',
  };

  test('an invite without e-mail is open', () => {
    expect(acceptMode({ ...base, email: null, accountExists: false })).toBe('open');
  });

  test('an e-mail invite for an existing account asks only the password', () => {
    expect(acceptMode({ ...base, email: 'a@b.com', accountExists: true })).toBe('existing-account');
  });

  test('an e-mail invite without an account creates one', () => {
    expect(acceptMode({ ...base, email: 'a@b.com', accountExists: false })).toBe('new-account');
  });
});

describe('buildAcceptInput', () => {
  test('open mode always sends e-mail, name and a password', () => {
    expect(
      buildAcceptInput('open', {
        ...EMPTY_FORM,
        email: ' Ana@Exemplo.com',
        name: ' Ana ',
        password: 'segredo123',
      }),
    ).toEqual({
      ok: true,
      data: { email: 'ana@exemplo.com', name: 'Ana', password: 'segredo123' },
    });
  });

  test('open mode requires a password of at least 8 characters', () => {
    expect(
      buildAcceptInput('open', { ...EMPTY_FORM, email: 'a@b.com', name: 'Ana', password: '123' }),
    ).toEqual({ ok: false, message: 'A senha precisa ter pelo menos 8 caracteres.' });
  });

  test('open mode requires the name', () => {
    expect(
      buildAcceptInput('open', { ...EMPTY_FORM, email: 'a@b.com', password: 'segredo123' }),
    ).toEqual({ ok: false, message: 'Informe seu nome.' });
  });

  test('existing-account mode sends only the password', () => {
    expect(buildAcceptInput('existing-account', { ...EMPTY_FORM, password: 'x' })).toEqual({
      ok: true,
      data: { password: 'x' },
    });
  });

  test('existing-account mode requires the password', () => {
    expect(buildAcceptInput('existing-account', EMPTY_FORM)).toEqual({
      ok: false,
      message: 'Informe sua senha.',
    });
  });

  test('new-account mode sends name and password', () => {
    expect(
      buildAcceptInput('new-account', {
        ...EMPTY_FORM,
        name: 'Ana',
        password: 'segredo123',
        confirmation: 'segredo123',
      }),
    ).toEqual({ ok: true, data: { name: 'Ana', password: 'segredo123' } });
  });

  test('new-account mode checks the confirmation', () => {
    expect(
      buildAcceptInput('new-account', {
        ...EMPTY_FORM,
        name: 'Ana',
        password: 'segredo123',
        confirmation: 'outra-senha',
      }),
    ).toEqual({ ok: false, message: 'As senhas não conferem.' });
  });
});
