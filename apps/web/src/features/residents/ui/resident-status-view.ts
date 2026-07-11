import type { PillTone } from '@/shared/ui/status-pill';

import type { ResidentStatus } from '../domain/resident';

const VIEW: Record<ResidentStatus, { tone: PillTone; label: string }> = {
  em_dia: { tone: 'pago', label: 'Em dia' },
  pendente: { tone: 'pendente', label: 'Pendente' },
  atrasado: { tone: 'atrasado', label: 'Atrasado' },
};

export function residentStatusView(status: ResidentStatus): { tone: PillTone; label: string } {
  return VIEW[status];
}
