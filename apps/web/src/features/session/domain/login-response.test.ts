import { parseLoginResponse } from './login-response';

const SINDICO = {
  id: 'c1',
  name: 'Morada',
  role: 'admin',
  condoRole: 'sindico',
  permissions: ['view_building', 'publish_notices', 'manage_residents', 'manage_money'],
  hasHome: true,
  organizationId: 'o1',
  orgRole: null,
};

describe('parseLoginResponse', () => {
  test('accepts a síndico condo with its permissions and home', () => {
    const parsed = parseLoginResponse({ condos: [SINDICO], emailVerified: true });

    expect(parsed.condos[0]).toMatchObject({ condoRole: 'sindico', hasHome: true, orgRole: null });
    expect(parsed.condos[0]?.permissions).toHaveLength(4);
  });

  test('rejects an unknown permission', () => {
    const condo = { ...SINDICO, permissions: ['view_building', 'fly'] };

    expect(() => parseLoginResponse({ condos: [condo], emailVerified: true })).toThrow();
  });

  test('returns the condos and the e-mail verification flag', () => {
    const condos = [SINDICO];

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
