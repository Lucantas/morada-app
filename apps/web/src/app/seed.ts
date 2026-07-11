import type { Account } from '@/features/accounts/domain/account';
import type { DashboardSummary } from '@/features/dashboard/domain/dashboard';
import type { Receipt } from '@/features/receipts/domain/receipt';
import type { Resident } from '@/features/residents/domain/resident';

export const residentSeed: Resident[] = [
  {
    id: 'r-1',
    name: 'Maria Ribeiro',
    apt: 'Apto 302',
    phone: '(11) 90000-0001',
    email: 'maria@email.com',
    status: 'em_dia',
  },
  {
    id: 'r-2',
    name: 'João Pereira',
    apt: 'Apto 101',
    phone: '(11) 90000-0002',
    email: 'joao@email.com',
    status: 'em_dia',
  },
  {
    id: 'r-3',
    name: 'Ana Costa',
    apt: 'Apto 202',
    phone: '(11) 90000-0003',
    email: 'ana@email.com',
    status: 'pendente',
  },
  {
    id: 'r-4',
    name: 'Carlos Souza',
    apt: 'Apto 402',
    phone: '(11) 90000-0004',
    email: 'carlos@email.com',
    status: 'em_dia',
  },
  {
    id: 'r-5',
    name: 'Beatriz Lima',
    apt: 'Apto 201',
    phone: '(11) 90000-0005',
    email: 'bia@email.com',
    status: 'atrasado',
  },
  {
    id: 'r-6',
    name: 'Rafael Alves',
    apt: 'Apto 301',
    phone: '(11) 90000-0006',
    email: 'rafael@email.com',
    status: 'em_dia',
  },
  {
    id: 'r-7',
    name: 'Fernanda Dias',
    apt: 'Apto 401',
    phone: '(11) 90000-0007',
    email: 'fernanda@email.com',
    status: 'em_dia',
  },
];

export const accountSeed: Account[] = [
  {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    dateLabel: '05/04',
    valueCents: 124000,
    status: 'pago',
  },
  {
    id: 'a-2',
    description: 'Energia — áreas comuns',
    category: 'Utilidades',
    dateLabel: '03/04',
    valueCents: 89000,
    status: 'pago',
  },
  {
    id: 'a-3',
    description: 'Limpeza',
    category: 'Serviços',
    dateLabel: '02/04',
    valueCents: 150000,
    status: 'pago',
  },
  {
    id: 'a-4',
    description: 'Jardinagem',
    category: 'Serviços',
    dateLabel: '12/04',
    valueCents: 45000,
    status: 'pendente',
  },
  {
    id: 'a-5',
    description: 'Reparo portão',
    category: 'Manutenção',
    dateLabel: '15/04',
    valueCents: 30000,
    status: 'atrasado',
  },
];

export const receiptSeed: Receipt[] = [
  {
    id: 'rc-1',
    ref: '04/2026',
    title: 'Taxa condominial',
    dueLabel: 'Venc. 10/04/2026',
    valueCents: 45000,
    status: 'pendente',
  },
  {
    id: 'rc-2',
    ref: '03/2026',
    title: 'Taxa condominial',
    dueLabel: 'Pago em 08/03/2026',
    valueCents: 45000,
    status: 'pago',
    method: 'pix',
  },
  {
    id: 'rc-3',
    ref: '02/2026',
    title: 'Taxa condominial',
    dueLabel: 'Pago em 07/02/2026',
    valueCents: 45000,
    status: 'pago',
    method: 'boleto',
  },
  {
    id: 'rc-4',
    ref: '01/2026',
    title: 'Taxa condominial',
    dueLabel: 'Pago em 09/01/2026',
    valueCents: 45000,
    status: 'pago',
    method: 'pix',
  },
];

export const dashboardSeed: DashboardSummary = {
  balance: { balanceCents: 1248000, incomeCents: 836000, paidCents: 412000 },
  recentPaid: [
    {
      id: 'p-1',
      label: 'Conta de água — abril',
      dateLabel: 'Paga em 05/04',
      valueCents: 124000,
      icon: 'water',
    },
    {
      id: 'p-2',
      label: 'Energia — áreas comuns',
      dateLabel: 'Paga em 03/04',
      valueCents: 89000,
      icon: 'bolt',
    },
  ],
  maintenances: [
    { id: 'm-1', title: "Bomba d'água", detail: 'Reparo · 28/03', icon: 'wrench' },
    { id: 'm-2', title: 'Pintura do hall', detail: 'Concluída · 20/03', icon: 'building2' },
  ],
};
