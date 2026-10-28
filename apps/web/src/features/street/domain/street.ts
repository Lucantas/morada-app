import { z } from 'zod';

import { loginCondoSchema } from '@/features/session/domain/login-response';

const countSchema = z.number().int().min(0);

export const pendenciesSchema = z.object({
  overdueResidents: countSchema,
  overdueAccounts: countSchema,
  accountsDueSoon: countSchema,
  proofsToReview: countSchema,
  unreadThreads: countSchema,
});

export const streetWindowSchema = z.object({
  block: z.string().nullable(),
  floor: z.number().int(),
  position: z.number().int().min(1),
  lit: z.boolean(),
});

export const streetCondoSchema = loginCondoSchema.extend({
  pendencies: pendenciesSchema,
  windows: z.array(streetWindowSchema),
});

export const streetSchema = z.object({
  name: z.string().nullable(),
  condos: z.array(streetCondoSchema),
  homes: z.array(loginCondoSchema),
});

export type Pendencies = z.infer<typeof pendenciesSchema>;
export type StreetWindow = z.infer<typeof streetWindowSchema>;
export type StreetCondo = z.infer<typeof streetCondoSchema>;
export type Street = z.infer<typeof streetSchema>;

export type FlagLevel = 'urgente' | 'atencao';
export type ReasonKind =
  | 'overdue_residents'
  | 'overdue_accounts'
  | 'accounts_due_soon'
  | 'proofs_to_review'
  | 'unread_threads';
export type Reason = {
  kind: ReasonKind;
  level: FlagLevel;
  count: number;
  text: string;
  flag: string;
};

type ReasonSpec = {
  kind: ReasonKind;
  key: keyof Pendencies;
  level: FlagLevel;
  text: (count: number) => string;
  flag: (count: number) => string;
};

const plural = (count: number, one: string, many: string): string =>
  count === 1 ? `1 ${one}` : `${count} ${many}`;

const REASON_SPECS: readonly ReasonSpec[] = [
  {
    kind: 'overdue_residents',
    key: 'overdueResidents',
    level: 'urgente',
    text: (n) => plural(n, 'morador com taxa vencida', 'moradores com taxa vencida'),
    flag: (n) => plural(n, 'atrasado', 'atrasados'),
  },
  {
    kind: 'overdue_accounts',
    key: 'overdueAccounts',
    level: 'urgente',
    text: (n) => plural(n, 'conta vencida', 'contas vencidas'),
    flag: (n) => plural(n, 'vencida', 'vencidas'),
  },
  {
    kind: 'accounts_due_soon',
    key: 'accountsDueSoon',
    level: 'atencao',
    text: (n) => plural(n, 'conta vence em até 3 dias', 'contas vencem em até 3 dias'),
    flag: () => 'vence em breve',
  },
  {
    kind: 'proofs_to_review',
    key: 'proofsToReview',
    level: 'atencao',
    text: (n) => plural(n, 'comprovante de Pix pra conferir', 'comprovantes de Pix pra conferir'),
    flag: (n) => `${n} comprov.`,
  },
  {
    kind: 'unread_threads',
    key: 'unreadThreads',
    level: 'atencao',
    text: (n) => plural(n, 'mensagem não lida', 'mensagens não lidas'),
    flag: (n) => `${n} msg`,
  },
];

export function reasonsOf(pendencies: Pendencies): Reason[] {
  return REASON_SPECS.filter((spec) => pendencies[spec.key] > 0).map((spec) => ({
    kind: spec.kind,
    level: spec.level,
    count: pendencies[spec.key],
    text: spec.text(pendencies[spec.key]),
    flag: spec.flag(pendencies[spec.key]),
  }));
}

export function levelOf(pendencies: Pendencies): FlagLevel | null {
  return reasonsOf(pendencies)[0]?.level ?? null;
}

const LEVEL_RANK: Record<FlagLevel | 'none', number> = { urgente: 0, atencao: 1, none: 2 };

function totalOf(pendencies: Pendencies): number {
  return REASON_SPECS.reduce((sum, spec) => sum + pendencies[spec.key], 0);
}

export function sortByUrgency(condos: StreetCondo[]): StreetCondo[] {
  return [...condos].sort(
    (a, b) =>
      LEVEL_RANK[levelOf(a.pendencies) ?? 'none'] - LEVEL_RANK[levelOf(b.pendencies) ?? 'none'] ||
      totalOf(b.pendencies) - totalOf(a.pendencies) ||
      a.name.localeCompare(b.name, 'pt-BR'),
  );
}

const MORNING_START = 5;
const AFTERNOON_START = 12;
const NIGHT_START = 18;

export function greeting(hour: number, name: string | null): string {
  const salutation =
    hour >= MORNING_START && hour < AFTERNOON_START
      ? 'Bom dia'
      : hour >= AFTERNOON_START && hour < NIGHT_START
        ? 'Boa tarde'
        : 'Boa noite';
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

export function summaryLine(total: number, needingAttention: number): string {
  const condos = plural(total, 'condomínio', 'condomínios');
  const attention =
    needingAttention === 0
      ? 'nada pede atenção hoje'
      : needingAttention === 1
        ? '1 pede atenção hoje'
        : `${needingAttention} pedem atenção hoje`;
  return `${condos} · ${attention}`;
}

export type MiniBlock = { block: string | null; floors: boolean[][] };

export function miniBuilding(windows: StreetWindow[]): MiniBlock[] {
  const blocks = windows.reduce<Map<string | null, StreetWindow[]>>(
    (acc, window) => new Map(acc).set(window.block, [...(acc.get(window.block) ?? []), window]),
    new Map(),
  );
  const ordered = [...blocks.entries()].sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : 0));

  return ordered.map(([block, items]) => {
    const width = Math.max(...items.map((w) => w.position));
    const floorNumbers = [...new Set(items.map((w) => w.floor))].sort((a, b) => b - a);
    return {
      block,
      floors: floorNumbers.map((floor) =>
        Array.from({ length: width }, (_, index) =>
          items.some((w) => w.floor === floor && w.position === index + 1 && w.lit),
        ),
      ),
    };
  });
}
