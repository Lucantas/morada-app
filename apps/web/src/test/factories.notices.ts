import type { Notice } from '@/features/notices/domain/notice';

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

export function buildNotice(overrides: Partial<Notice> = {}): Notice {
  return {
    id: nextId('notice'),
    title: "Manutenção da caixa d'água",
    body: 'A limpeza ocorrerá dia 12/04, das 9h às 12h.',
    kind: 'aviso',
    audience: 'Todos os moradores',
    dateLabel: 'Agora',
    dismissed: false,
    ...overrides,
  };
}
