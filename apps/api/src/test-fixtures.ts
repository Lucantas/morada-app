import bcrypt from 'bcryptjs';

import { config } from './platform/config';
import type { Db } from './platform/db';
import { insertAll } from './seed-data';

// Rich demo data for the test suite ONLY. Production seeds just the admin login
// (see seed-data.ts); the resident login + residents/accounts/receipts/notices/
// threads below back the integration tests.

// A pre-provisioned resident login, seeded only for tests (in production the
// admin creates resident logins in-app).
export const residentCredentials = {
  username: 'maria302',
  password: 'morada-demo',
  residentId: 'r-1',
} as const;

const residents = [
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

const accounts = [
  {
    id: 'a-1',
    description: 'Água — abril',
    category: 'Utilidades',
    date_label: '05/04',
    value_cents: 124000,
    status: 'pago',
  },
  {
    id: 'a-2',
    description: 'Energia — áreas comuns',
    category: 'Utilidades',
    date_label: '03/04',
    value_cents: 89000,
    status: 'pago',
  },
  {
    id: 'a-3',
    description: 'Limpeza',
    category: 'Serviços',
    date_label: '02/04',
    value_cents: 150000,
    status: 'pago',
  },
  {
    id: 'a-4',
    description: 'Jardinagem',
    category: 'Serviços',
    date_label: '12/04',
    value_cents: 45000,
    status: 'pendente',
  },
  {
    id: 'a-5',
    description: 'Reparo portão',
    category: 'Manutenção',
    date_label: '15/04',
    value_cents: 30000,
    status: 'atrasado',
  },
];

const receipts = [
  {
    id: 'rc-1',
    ref: '04/2026',
    title: 'Taxa condominial',
    due_label: 'Venc. 10/04/2026',
    value_cents: 45000,
    status: 'pendente',
    method: null,
    resident_id: 'r-1',
  },
  {
    id: 'rc-2',
    ref: '03/2026',
    title: 'Taxa condominial',
    due_label: 'Pago em 08/03/2026',
    value_cents: 45000,
    status: 'pago',
    method: 'pix',
    resident_id: 'r-1',
  },
  {
    id: 'rc-3',
    ref: '02/2026',
    title: 'Taxa condominial',
    due_label: 'Pago em 07/02/2026',
    value_cents: 45000,
    status: 'pago',
    method: 'boleto',
    resident_id: 'r-1',
  },
  {
    id: 'rc-4',
    ref: '01/2026',
    title: 'Taxa condominial',
    due_label: 'Pago em 09/01/2026',
    value_cents: 45000,
    status: 'pago',
    method: 'pix',
    resident_id: 'r-1',
  },
  {
    id: 'rc-5',
    ref: '04/2026',
    title: 'Taxa condominial',
    due_label: 'Venc. 10/04/2026',
    value_cents: 45000,
    status: 'pendente',
    method: null,
    resident_id: 'r-3',
  },
  ...['r-2', 'r-4', 'r-6', 'r-7'].flatMap((residentId) =>
    [
      { ref: '03/2026', due_label: 'Pago em 08/03/2026', method: 'pix' },
      { ref: '02/2026', due_label: 'Pago em 07/02/2026', method: 'boleto' },
      { ref: '01/2026', due_label: 'Pago em 09/01/2026', method: 'pix' },
    ].map((m) => ({
      id: `rc-${residentId}-${m.ref.slice(0, 2)}`,
      ref: m.ref,
      title: 'Taxa condominial',
      due_label: m.due_label,
      value_cents: 45000,
      status: 'pago',
      method: m.method,
      resident_id: residentId,
    })),
  ),
];

const notices = [
  {
    id: 'n-1',
    title: "Manutenção da caixa d'água",
    body: 'A limpeza ocorrerá dia 12/04, das 9h às 12h. Pode faltar água no período.',
    kind: 'manutencao',
    audience: 'Todos os moradores',
    date_label: 'Há 2 dias',
    dismissed: 0,
  },
  {
    id: 'n-2',
    title: 'Portão da garagem',
    body: 'O portão está com abertura lenta; técnico agendado para quinta.',
    kind: 'aviso',
    audience: 'Bloco 2',
    date_label: 'Há 5 dias',
    dismissed: 0,
  },
  {
    id: 'n-3',
    title: 'Assembleia extraordinária',
    body: 'Dia 20/04 às 19h no salão de festas. Presença importante.',
    kind: 'urgente',
    audience: 'Todos os moradores',
    date_label: 'Há 1 semana',
    dismissed: 0,
  },
];

const threads = [
  {
    id: 'r-1',
    resident_name: 'Maria Ribeiro',
    apt: 'Apto 302',
    unread: 0,
    messages: JSON.stringify([
      {
        id: 'm1',
        author: 'resident',
        text: 'Olá! A luz da garagem está queimada.',
        dateLabel: 'Ontem',
      },
      {
        id: 'm2',
        author: 'admin',
        text: 'Oi Maria, já acionamos o eletricista para amanhã.',
        dateLabel: 'Ontem',
      },
    ]),
  },
  {
    id: 't-2',
    resident_name: 'Ana Costa',
    apt: 'Apto 202',
    unread: 1,
    messages: JSON.stringify([
      { id: 'm3', author: 'resident', text: 'Posso reservar o salão dia 22?', dateLabel: 'Há 3h' },
    ]),
  },
];

export function seedFixtures(db: Db): void {
  insertAll(db, 'residents', ['id', 'name', 'apt', 'phone', 'email', 'status'], residents);
  insertAll(
    db,
    'users',
    ['id', 'username', 'password_hash', 'role', 'resident_id'],
    [
      {
        id: 'u-maria',
        username: residentCredentials.username,
        password_hash: bcrypt.hashSync(residentCredentials.password, config.bcryptCost),
        role: 'resident',
        resident_id: residentCredentials.residentId,
      },
    ],
  );
  insertAll(
    db,
    'accounts',
    ['id', 'description', 'category', 'date_label', 'value_cents', 'status'],
    accounts,
  );
  insertAll(
    db,
    'receipts',
    ['id', 'ref', 'title', 'due_label', 'value_cents', 'status', 'method', 'resident_id'],
    receipts,
  );
  insertAll(
    db,
    'notices',
    ['id', 'title', 'body', 'kind', 'audience', 'date_label', 'dismissed'],
    notices,
  );
  insertAll(db, 'threads', ['id', 'resident_name', 'apt', 'unread', 'messages'], threads);
}
