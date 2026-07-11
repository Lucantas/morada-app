import { buildResident } from '@/test/factories';

import { residentStats } from './resident-stats';

describe('residentStats', () => {
  test('counts total, em dia, and pendências', () => {
    const stats = residentStats([
      buildResident({ status: 'em_dia' }),
      buildResident({ status: 'em_dia' }),
      buildResident({ status: 'pendente' }),
      buildResident({ status: 'atrasado' }),
    ]);

    expect(stats).toEqual({ total: 4, emDia: 2, pendencias: 2 });
  });

  test('is all zero for no residents', () => {
    expect(residentStats([])).toEqual({ total: 0, emDia: 0, pendencias: 0 });
  });
});
