import type { PillTone } from '@/shared/ui/status-pill';

import type { NoticeKind } from '../domain/notice';

const VIEW: Record<NoticeKind, { tone: PillTone; label: string }> = {
  aviso: { tone: 'info', label: 'Aviso' },
  urgente: { tone: 'atrasado', label: 'Urgente' },
  manutencao: { tone: 'pendente', label: 'Manutenção' },
};

export function noticeKindView(kind: NoticeKind): { tone: PillTone; label: string } {
  return VIEW[kind];
}
