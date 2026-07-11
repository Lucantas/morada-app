import type { DashboardSummary } from '@/features/dashboard/domain/dashboard';

export function buildDashboardSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    balance: { balanceCents: 1_248_000, incomeCents: 836_000, paidCents: 412_000 },
    recentPaid: [
      {
        id: 'p-1',
        label: 'Conta de água — abril',
        dateLabel: 'Paga em 05/04',
        valueCents: 124_000,
        icon: 'water',
      },
      {
        id: 'p-2',
        label: 'Energia — áreas comuns',
        dateLabel: 'Paga em 03/04',
        valueCents: 89_000,
        icon: 'bolt',
      },
    ],
    maintenances: [
      { id: 'm-1', title: "Bomba d'água", detail: 'Reparo · 28/03', icon: 'wrench' },
      { id: 'm-2', title: 'Pintura do hall', detail: 'Concluída · 20/03', icon: 'building2' },
    ],
    ...overrides,
  };
}
