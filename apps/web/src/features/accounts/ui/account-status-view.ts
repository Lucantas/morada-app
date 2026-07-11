import type { PillTone } from '@/shared/ui/status-pill';

import type { AccountStatus } from '../domain/account';

const VIEW: Record<AccountStatus, { tone: PillTone; label: string }> = {
  pago: { tone: 'pago', label: 'Pago' },
  pendente: { tone: 'pendente', label: 'Pendente' },
  atrasado: { tone: 'atrasado', label: 'Atrasado' },
};

export function accountStatusView(status: AccountStatus): { tone: PillTone; label: string } {
  return VIEW[status];
}
