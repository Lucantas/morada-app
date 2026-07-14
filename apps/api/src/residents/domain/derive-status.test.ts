import { deriveResidentStatus } from './derive-status';

describe('deriveResidentStatus', () => {
  test('a resident with a pending receipt is pendente', () => {
    expect(deriveResidentStatus(true)).toBe('pendente');
  });

  test('a resident with no pending receipt is em_dia', () => {
    expect(deriveResidentStatus(false)).toBe('em_dia');
  });
});
