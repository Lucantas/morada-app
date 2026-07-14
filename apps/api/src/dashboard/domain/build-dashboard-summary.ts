import { dashboardSummarySchema, type DashIcon, type DashboardSummary } from './dashboard';

export interface LedgerAccount {
  id: string;
  description: string;
  category: string;
  date: string | null;
  valueCents: number;
  status: string;
}

// ISO (YYYY-MM-DD) -> BR (DD/MM/YYYY) for display. Callers guard against null.
function formatBrDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export interface LedgerReceipt {
  valueCents: number;
  status: string;
}

const PAID = 'pago';
const RECENT_PAID_LIMIT = 4;

const STATUS_LABELS: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
};

function iconForAccount(account: LedgerAccount): DashIcon {
  const text = `${account.category} ${account.description}`.toLowerCase();
  if (/[áa]gua|water/.test(text)) return 'water';
  if (/energia|luz|el[ée]tr/.test(text)) return 'bolt';
  if (/manuten|reparo|conserto/.test(text)) return 'wrench';
  if (/limpeza|jardin|servi[çc]/.test(text)) return 'building';
  return 'receipt';
}

function sum(values: { valueCents: number }[]): number {
  return values.reduce((total, v) => total + v.valueCents, 0);
}

export function buildDashboardSummary(
  accounts: LedgerAccount[],
  receipts: LedgerReceipt[],
): DashboardSummary {
  const paidAccounts = accounts.filter((a) => a.status === PAID);
  const incomeCents = sum(receipts.filter((r) => r.status === PAID));
  const paidCents = sum(paidAccounts);

  const recentPaid = [...paidAccounts]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, RECENT_PAID_LIMIT)
    .map((a) => ({
      id: a.id,
      label: a.description,
      dateLabel: a.date ? `Paga em ${formatBrDate(a.date)}` : 'Paga',
      valueCents: a.valueCents,
      icon: iconForAccount(a),
    }));

  const maintenances = accounts
    .filter((a) => /manuten/i.test(a.category))
    .map((a) => ({
      id: a.id,
      title: a.description,
      detail: `${STATUS_LABELS[a.status] ?? a.status}${a.date ? ` · ${formatBrDate(a.date)}` : ''}`,
      icon: 'wrench' as const,
    }));

  return dashboardSummarySchema.parse({
    balance: { balanceCents: incomeCents - paidCents, incomeCents, paidCents },
    recentPaid,
    maintenances,
  });
}
