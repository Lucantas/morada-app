import { parseLoginResponse } from './login-response';

describe('parseLoginResponse', () => {
  test('returns the condos and the e-mail verification flag', () => {
    const condos = [{ id: 'c1', name: 'Morada', role: 'admin' }];

    expect(parseLoginResponse({ condos, emailVerified: true })).toEqual({
      condos,
      emailVerified: true,
    });
  });

  test('accepts an empty condo list', () => {
    expect(parseLoginResponse({ condos: [], emailVerified: false })).toEqual({
      condos: [],
      emailVerified: false,
    });
  });

  test('rejects a body without the verification flag', () => {
    expect(() => parseLoginResponse({ condos: [] })).toThrow();
  });

  test('rejects a malformed body', () => {
    expect(() => parseLoginResponse({ role: 'admin' })).toThrow();
  });
});
