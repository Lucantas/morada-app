import { AccountError } from '../domain/errors';

import { accountErrorMessage, loginErrorMessage } from './account-error-message';

describe('loginErrorMessage', () => {
  test.each([
    ['invalid-credentials', 'Usuário ou senha inválidos.'],
    ['rate-limited', 'Muitas tentativas, tente mais tarde.'],
    ['unavailable', 'Não foi possível entrar. Verifique a conexão com o servidor.'],
  ] as const)('maps %s', (kind, message) => {
    expect(loginErrorMessage(new AccountError(kind))).toBe(message);
  });

  test('treats an unknown failure as a connection problem', () => {
    expect(loginErrorMessage(new Error('boom'))).toBe(
      'Não foi possível entrar. Verifique a conexão com o servidor.',
    );
  });
});

describe('accountErrorMessage', () => {
  test('prefers the screen-specific message', () => {
    expect(
      accountErrorMessage(new AccountError('invalid-credentials'), {
        'invalid-credentials': 'Senha incorreta.',
      }),
    ).toBe('Senha incorreta.');
  });

  test('falls back to the connection message', () => {
    expect(accountErrorMessage(new AccountError('invalid-link'))).toBe(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
  });
});
