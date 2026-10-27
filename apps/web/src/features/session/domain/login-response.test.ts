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
    expect(parseLoginResponse({ condos: [SINDICO], emailVerified: true })).toEqual({
      condos: [{ ...SINDICO, onboardingPending: false }],
      emailVerified: true,
    });
  });

  test('keeps a pending onboarding and defaults it to false when absent', () => {
    const pending = { ...SINDICO, onboardingPending: true };

    expect(parseLoginResponse({ condos: [pending], emailVerified: true }).condos[0]).toMatchObject({
      onboardingPending: true,
    });
    expect(parseLoginResponse({ condos: [SINDICO], emailVerified: true }).condos[0]).toMatchObject({
      onboardingPending: false,
    });
  });

  test('keeps the invited condo id of an accepted invitation', () => {
    expect(
      parseLoginResponse({ condos: [SINDICO], emailVerified: true, invitedCondoId: 'c1' }),
    ).toEqual({
      condos: [{ ...SINDICO, onboardingPending: false }],
      emailVerified: true,
      invitedCondoId: 'c1',
    });
    expect(
      parseLoginResponse({ condos: [], emailVerified: true, invitedCondoId: null }).invitedCondoId,
    ).toBeNull();
  });

  test('rejects an empty invited condo id', () => {
    expect(() =>
      parseLoginResponse({ condos: [], emailVerified: true, invitedCondoId: '' }),
    ).toThrow();
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
