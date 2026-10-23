import { AuthError } from '../domain/errors';

import { authErrorMessage, loginErrorMessage } from './auth-error-message';

describe('loginErrorMessage', () => {
  test.each([
    ['invalid-credentials', 'Usuário ou senha inválidos.'],
    ['rate-limited', 'Muitas tentativas, tente mais tarde.'],
    ['unavailable', 'Não foi possível entrar. Verifique a conexão com o servidor.'],
  ] as const)('maps %s', (kind, message) => {
    expect(loginErrorMessage(new AuthError(kind))).toBe(message);
  });

  test('treats an unknown failure as a connection problem', () => {
    expect(loginErrorMessage(new Error('boom'))).toBe(
      'Não foi possível entrar. Verifique a conexão com o servidor.',
    );
  });
});

describe('authErrorMessage', () => {
  test('prefers the screen-specific message', () => {
    expect(
      authErrorMessage(new AuthError('invalid-credentials'), {
        'invalid-credentials': 'Senha incorreta.',
      }),
    ).toBe('Senha incorreta.');
  });

  test('falls back to the connection message', () => {
    expect(authErrorMessage(new AuthError('invalid-link'))).toBe(
      'Não foi possível concluir. Verifique a conexão com o servidor.',
    );
  });

  test('explains an expired session', () => {
    expect(authErrorMessage(new AuthError('session-expired'))).toBe(
      'Sua sessão expirou. Entre novamente.',
    );
  });

  test('asks to review the data on invalid input', () => {
    expect(authErrorMessage(new AuthError('invalid-input'))).toBe('Confira os dados informados.');
  });
});
