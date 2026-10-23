import { clearPublicRoute, parsePublicRoute } from './public-route';

const TOKEN = 'abcDEF0123456789_-xyzABCDEF0123456789abcde';

describe('parsePublicRoute', () => {
  test.each(['convite', 'confirmar-email', 'redefinir-senha'] as const)(
    'accepts the %s route with a valid token',
    (kind) => {
      expect(parsePublicRoute(`#/${kind}/${TOKEN}`)).toEqual({ kind, token: TOKEN });
    },
  );

  test('rejects a token shorter than 20 characters', () => {
    expect(parsePublicRoute('#/confirmar-email/short')).toBeNull();
  });

  test('rejects a token longer than 128 characters', () => {
    expect(parsePublicRoute(`#/confirmar-email/${'a'.repeat(129)}`)).toBeNull();
  });

  test('rejects a token with characters outside base64url', () => {
    expect(parsePublicRoute(`#/redefinir-senha/${TOKEN}!<script>`)).toBeNull();
  });

  test('rejects an unknown route', () => {
    expect(parsePublicRoute(`#/admin/${TOKEN}`)).toBeNull();
  });

  test('rejects an empty hash', () => {
    expect(parsePublicRoute('')).toBeNull();
  });
});

describe('clearPublicRoute', () => {
  test('drops the hash and keeps the history state', () => {
    window.history.replaceState({ view: 'a-home' }, '', `/painel?x=1#/convite/${TOKEN}`);

    clearPublicRoute();

    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/painel');
    expect(window.location.search).toBe('?x=1');
    expect(window.history.state).toEqual({ view: 'a-home' });
  });
});
