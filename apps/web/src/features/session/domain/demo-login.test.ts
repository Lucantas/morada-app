import { resolveDemoLogin } from './demo-login';

describe('resolveDemoLogin', () => {
  test('resolves the admin demo credentials to the admin role', () => {
    expect(resolveDemoLogin('admin', 'morada-admin')).toEqual({
      role: 'admin',
      subject: 'u-admin',
    });
  });

  test('resolves the resident demo credentials to their resident id', () => {
    expect(resolveDemoLogin('maria302', 'morada-demo')).toEqual({
      role: 'resident',
      subject: 'r-1',
    });
  });

  test('returns null for a wrong password', () => {
    expect(resolveDemoLogin('admin', 'nope')).toBeNull();
  });

  test('returns null for an unknown username', () => {
    expect(resolveDemoLogin('ninguem', 'morada-admin')).toBeNull();
  });
});
