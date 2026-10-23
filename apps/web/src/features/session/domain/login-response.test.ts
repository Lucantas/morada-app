import { parseLoginResponse } from './login-response';

describe('parseLoginResponse', () => {
  test('returns the condos list', () => {
    const condos = [{ id: 'c1', name: 'Morada', role: 'admin' }];
    expect(parseLoginResponse({ condos })).toEqual(condos);
  });

  test('rejects an empty list', () => {
    expect(() => parseLoginResponse({ condos: [] })).toThrow();
  });

  test('rejects a malformed body', () => {
    expect(() => parseLoginResponse({ role: 'admin' })).toThrow();
  });
});
