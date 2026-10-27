import { z } from 'zod';

import {
  DEFAULT_DUE_DAY,
  MAX_APARTMENTS,
  MAX_BLOCKS,
  MAX_BLOCK_NAME,
  MAX_DUE_DAY,
  MAX_FLOORS,
  MAX_MONTHLY_FEE_CENTS,
  MAX_PER_FLOOR,
  apartmentCount,
  createCondoInputSchema,
  type Block,
  type CreateCondoInput,
} from '@/features/condos/domain/create-condo';
import { condoNameSchema } from '@/features/condos/domain/condo-info';
import type { PixDraft } from '@/features/settings/domain/pix-draft';
import { PIX_KEY_TYPE_LABELS, pixSettingsSchema } from '@/features/settings/domain/pix-settings';
import { formatBRL } from '@/shared/lib/money';

export type Question =
  | 'name'
  | 'hasBlocks'
  | 'blockCount'
  | 'blockNames'
  | 'sameShape'
  | 'shape'
  | 'fee'
  | 'pix'
  | 'review';

const MIN_BLOCKS = 2;
const LATER = 'Depois eu vejo';
const SHAPE_QUESTION = 'quantos andares, e quantos apartamentos por andar?';

const feeSchema = z.object({ feeCents: z.number(), dueDay: z.number() });

export const answerSchema = z.discriminatedUnion('question', [
  z.object({ question: z.literal('name'), name: z.string(), text: z.string() }),
  z.object({ question: z.literal('hasBlocks'), hasBlocks: z.boolean(), text: z.string() }),
  z.object({ question: z.literal('blockCount'), count: z.number(), text: z.string() }),
  z.object({ question: z.literal('blockNames'), names: z.array(z.string()), text: z.string() }),
  z.object({ question: z.literal('sameShape'), same: z.boolean(), text: z.string() }),
  z.object({
    question: z.literal('shape'),
    floors: z.number(),
    perFloor: z.number(),
    text: z.string(),
  }),
  z.object({ question: z.literal('fee'), fee: feeSchema.nullable(), text: z.string() }),
  z.object({ question: z.literal('pix'), pix: pixSettingsSchema.nullable(), text: z.string() }),
]);

export type Answer = z.output<typeof answerSchema>;

export type AnswerInput =
  | { question: 'name'; name: string }
  | { question: 'hasBlocks'; hasBlocks: boolean }
  | { question: 'blockCount'; count: number }
  | { question: 'blockNames'; names: string }
  | { question: 'sameShape'; same: boolean }
  | { question: 'shape'; floors: number; perFloor: number }
  | { question: 'fee'; fee: { feeCents: number; dueDay: number } | null }
  | { question: 'pix'; draft: PixDraft | null };

export type ConversationState = {
  answers: Answer[];
  current: Question;
  shapeIndex: number;
};

type Result = { state: ConversationState } | { error: string };

type AnswerOf<Q extends Answer['question']> = Extract<Answer, { question: Q }>;

function find<Q extends Answer['question']>(
  answers: readonly Answer[],
  question: Q,
): AnswerOf<Q> | undefined {
  return answers.find((item): item is AnswerOf<Q> => item.question === question);
}

function shapeAnswers(answers: readonly Answer[]): AnswerOf<'shape'>[] {
  return answers.filter((item): item is AnswerOf<'shape'> => item.question === 'shape');
}

function blockCount(answers: readonly Answer[]): number {
  return find(answers, 'blockCount')?.count ?? 1;
}

function shapesNeeded(answers: readonly Answer[]): number | null {
  const hasBlocks = find(answers, 'hasBlocks');
  if (!hasBlocks) return null;
  if (!hasBlocks.hasBlocks) return 1;
  const same = find(answers, 'sameShape');
  if (!same) return null;
  return same.same ? 1 : blockCount(answers);
}

function questionPlan(answers: readonly Answer[]): Question[] {
  const hasBlocks = find(answers, 'hasBlocks')?.hasBlocks;
  const blockQuestions: Question[] = hasBlocks ? ['blockCount', 'blockNames', 'sameShape'] : [];
  const opening: Question[] = ['name', 'hasBlocks', ...blockQuestions];
  const shapes = shapesNeeded(answers);
  if (shapes === null) return opening;
  const shapeQuestions = Array.from({ length: shapes }, (): Question => 'shape');
  return [...opening, ...shapeQuestions, 'fee', 'pix', 'review'];
}

function stateOf(answers: Answer[]): ConversationState {
  return {
    answers,
    current: questionPlan(answers)[answers.length] ?? 'review',
    shapeIndex: shapeAnswers(answers).length,
  };
}

export function startConversation(): ConversationState {
  return stateOf([]);
}

export function restoreConversation(answers: readonly Answer[]): ConversationState | null {
  const inOrder = answers.every(
    (item, index) => questionPlan(answers.slice(0, index))[index] === item.question,
  );
  return inOrder ? stateOf([...answers]) : null;
}

export function undo(state: ConversationState): ConversationState {
  return stateOf(state.answers.slice(0, -1));
}

export function defaultBlockNames(count: number): string {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index)).join(', ');
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos.';
}

function isIntIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function answerName(name: string): Answer | string {
  const parsed = condoNameSchema.safeParse(name);
  if (!parsed.success) return firstIssue(parsed.error);
  return { question: 'name', name: parsed.data, text: parsed.data };
}

function answerBlockCount(count: number): Answer | string {
  if (!isIntIn(count, MIN_BLOCKS, MAX_BLOCKS)) return 'Informe de 2 a 10 blocos.';
  return { question: 'blockCount', count, text: `${count} blocos` };
}

function answerBlockNames(raw: string, expected: number): Answer | string {
  const names = raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  if (names.length !== expected) return `Informe ${expected} nomes, separados por vírgula.`;
  if (names.some((name) => name.length > MAX_BLOCK_NAME)) return 'Use até 30 caracteres por nome.';
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    return 'Os blocos precisam de nomes diferentes.';
  }
  return { question: 'blockNames', names, text: names.join(', ') };
}

function apartmentsSoFar(answers: readonly Answer[], floors: number, perFloor: number): number {
  const same = find(answers, 'sameShape')?.same ?? false;
  const shape = { floors, perFloor };
  const blocks = same ? Array.from({ length: blockCount(answers) }, () => shape) : [shape];
  return apartmentCount([...shapeAnswers(answers), ...blocks]);
}

function answerShape(
  answers: readonly Answer[],
  floors: number,
  perFloor: number,
): Answer | string {
  if (!isIntIn(floors, 1, MAX_FLOORS)) return 'Informe de 1 a 60 andares.';
  if (!isIntIn(perFloor, 1, MAX_PER_FLOOR)) return 'Informe de 1 a 20 apartamentos por andar.';
  if (apartmentsSoFar(answers, floors, perFloor) > MAX_APARTMENTS) {
    return 'Use até 2000 apartamentos no total.';
  }
  const text = `${plural(floors, 'andar', 'andares')}, ${perFloor} por andar`;
  return { question: 'shape', floors, perFloor, text };
}

function feeText(fee: { feeCents: number; dueDay: number }): string {
  return `R$ ${formatBRL(fee.feeCents)}, até o dia ${fee.dueDay}`;
}

function answerFee(fee: { feeCents: number; dueDay: number } | null): Answer | string {
  if (fee === null) return { question: 'fee', fee: null, text: LATER };
  if (!isIntIn(fee.feeCents, 0, MAX_MONTHLY_FEE_CENTS)) return 'Valor muito alto.';
  if (!isIntIn(fee.dueDay, 1, MAX_DUE_DAY)) return 'Escolha um dia de 1 a 28.';
  return { question: 'fee', fee, text: feeText(fee) };
}

function answerPix(draft: PixDraft | null): Answer | string {
  if (draft === null) return { question: 'pix', pix: null, text: LATER };
  const parsed = pixSettingsSchema.safeParse(draft);
  if (!parsed.success) return firstIssue(parsed.error);
  const text = `${PIX_KEY_TYPE_LABELS[parsed.data.keyType]} · ${parsed.data.key}`;
  return { question: 'pix', pix: parsed.data, text };
}

function toAnswer(state: ConversationState, input: AnswerInput): Answer | string {
  switch (input.question) {
    case 'name':
      return answerName(input.name);
    case 'hasBlocks':
      return {
        question: 'hasBlocks',
        hasBlocks: input.hasBlocks,
        text: input.hasBlocks ? 'Tem blocos' : 'Só um prédio',
      };
    case 'blockCount':
      return answerBlockCount(input.count);
    case 'blockNames':
      return answerBlockNames(input.names, blockCount(state.answers));
    case 'sameShape':
      return { question: 'sameShape', same: input.same, text: input.same ? 'Sim' : 'Não' };
    case 'shape':
      return answerShape(state.answers, input.floors, input.perFloor);
    case 'fee':
      return answerFee(input.fee);
    case 'pix':
      return answerPix(input.draft);
  }
}

export function answer(state: ConversationState, input: AnswerInput): Result {
  if (input.question !== state.current) return { error: 'Responda a pergunta atual.' };
  const next = toAnswer(state, input);
  if (typeof next === 'string') return { error: next };
  return { state: stateOf([...state.answers, next]) };
}

function condoName(state: ConversationState): string {
  return find(state.answers, 'name')?.name ?? '';
}

function blockNames(state: ConversationState): string[] {
  return find(state.answers, 'blockNames')?.names ?? [];
}

function differentBlocks(state: ConversationState): boolean {
  return find(state.answers, 'sameShape')?.same === false;
}

function shapeText(state: ConversationState): string {
  if (!differentBlocks(state)) return 'Quantos andares, e quantos apartamentos por andar?';
  const name = blockNames(state)[state.shapeIndex] ?? '';
  return state.shapeIndex === 0
    ? `No Bloco ${name}: ${SHAPE_QUESTION}`
    : `E o Bloco ${name}: ${SHAPE_QUESTION}`;
}

const QUESTION_TEXT: Record<Exclude<Question, 'shape' | 'review'>, string> = {
  name: 'Que condomínio vamos gerenciar hoje?',
  hasBlocks: 'Ele tem blocos ou é um prédio só?',
  blockCount: 'Quantos blocos?',
  blockNames: 'Como se chama cada bloco?',
  sameShape: 'Os blocos são iguais?',
  fee: 'Quanto cada apartamento paga por mês, e até que dia?',
  pix: 'E pra onde vai o Pix?',
};

export function questionText(state: ConversationState): string {
  if (state.current === 'shape') return shapeText(state);
  if (state.current === 'review') return `Tudo certo? Vou montar o ${condoName(state)}.`;
  return QUESTION_TEXT[state.current];
}

function blocksOf(state: ConversationState): Block[] {
  const shapes = shapeAnswers(state.answers).map(({ floors, perFloor }) => ({ floors, perFloor }));
  const names = blockNames(state);
  const first = shapes[0] ?? { floors: 0, perFloor: 0 };
  if (names.length === 0) return [{ name: null, ...first }];
  return names.map((name, index) => ({
    name,
    ...(differentBlocks(state) ? (shapes[index] ?? first) : first),
  }));
}

export function toCreateCondoInput(state: ConversationState): CreateCondoInput {
  if (state.current !== 'review') throw new Error('A conversa não terminou');
  const fee = find(state.answers, 'fee')?.fee ?? null;
  return createCondoInputSchema.parse({
    name: condoName(state),
    structure: { blocks: blocksOf(state) },
    monthlyFeeCents: fee?.feeCents ?? 0,
    dueDay: fee?.dueDay ?? DEFAULT_DUE_DAY,
    pix: find(state.answers, 'pix')?.pix ?? null,
  });
}

export function transcript(state: ConversationState): { question: string; answer: string }[] {
  return state.answers.map((item, index) => ({
    question: questionText(stateOf(state.answers.slice(0, index))),
    answer: item.text,
  }));
}

export function reviewSummary(state: ConversationState): string[] {
  const blocks = blocksOf(state);
  const names = blockNames(state);
  const apartments = plural(apartmentCount(blocks), 'apartamento', 'apartamentos');
  const structure =
    names.length === 0
      ? apartments
      : `${names.length} blocos (${names.join(', ')}) · ${apartments}`;
  const fee = find(state.answers, 'fee')?.fee ?? null;
  const pix = find(state.answers, 'pix')?.pix ?? null;
  return [
    condoName(state),
    structure,
    `Mensalidade: ${fee === null ? 'depois' : feeText(fee)}`,
    `Pix: ${pix === null ? 'depois' : `${PIX_KEY_TYPE_LABELS[pix.keyType]} · ${pix.key}`}`,
  ];
}
