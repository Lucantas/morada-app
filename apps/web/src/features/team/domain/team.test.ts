import { buildTeamMember, TEAM } from '@/test/factories.team';

import { memberLabel, toggleCondo, validateTeamEmail } from './team';

describe('team domain', () => {
  test('toggleCondo adds and removes in organization order', () => {
    expect(toggleCondo(TEAM.condos, ['c2'], 'c1')).toEqual(['c1', 'c2']);
    expect(toggleCondo(TEAM.condos, ['c1', 'c2'], 'c1')).toEqual(['c2']);
  });

  test('memberLabel prefers name, then e-mail', () => {
    expect(memberLabel(buildTeamMember())).toBe('Bruno Alves');
    expect(memberLabel(buildTeamMember({ name: null }))).toBe('bruno@exemplo.com');
    expect(memberLabel(buildTeamMember({ name: null, email: null }))).toBe('Sem nome');
  });

  test('validateTeamEmail requires a valid e-mail', () => {
    expect(validateTeamEmail('  ')).toEqual({ ok: false, message: 'Informe o e-mail da pessoa' });
    expect(validateTeamEmail('x').ok).toBe(false);
    expect(validateTeamEmail(' A@b.com ')).toEqual({ ok: true, data: 'a@b.com' });
  });
});
