import {
  condoNameSchema,
  emailSchema,
  newPasswordSchema,
  signUpInputSchema,
  validate,
} from './account-schemas';

describe('account schemas', () => {
  test('normalizes the e-mail', () => {
    expect(emailSchema.parse('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
  });

  test('rejects an invalid e-mail with a PT-BR message', () => {
    expect(validate(emailSchema, 'ana')).toEqual({
      ok: false,
      message: 'Informe um e-mail válido.',
    });
  });

  test('accepts a complete sign-up and trims the name', () => {
    expect(
      validate(signUpInputSchema, {
        name: ' Ana ',
        email: 'ana@exemplo.com',
        password: '12345678',
      }),
    ).toEqual({ ok: true, data: { name: 'Ana', email: 'ana@exemplo.com', password: '12345678' } });
  });

  test('rejects a sign-up without a name', () => {
    expect(
      validate(signUpInputSchema, { name: ' ', email: 'ana@exemplo.com', password: '12345678' }),
    ).toEqual({ ok: false, message: 'Informe seu nome.' });
  });

  test('rejects a password shorter than 8 characters', () => {
    expect(validate(newPasswordSchema, { password: '1234567', confirmation: '1234567' })).toEqual({
      ok: false,
      message: 'A senha precisa ter pelo menos 8 caracteres.',
    });
  });

  test('rejects a confirmation that does not match', () => {
    expect(validate(newPasswordSchema, { password: '12345678', confirmation: '12345679' })).toEqual(
      { ok: false, message: 'As senhas não conferem.' },
    );
  });

  test('rejects a blank condominium name', () => {
    expect(validate(condoNameSchema, '   ')).toEqual({
      ok: false,
      message: 'Informe o nome do condomínio.',
    });
  });

  test('rejects a condominium name longer than 80 characters', () => {
    expect(validate(condoNameSchema, 'a'.repeat(81))).toEqual({
      ok: false,
      message: 'Use até 80 caracteres.',
    });
  });
});
