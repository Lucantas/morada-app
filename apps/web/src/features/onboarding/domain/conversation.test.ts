import {
  answer,
  defaultBlockNames,
  questionText,
  restoreConversation,
  transcript,
  reviewSummary,
  startConversation,
  toCreateCondoInput,
  undo,
  type AnswerInput,
  type ConversationState,
} from './conversation';

function play(inputs: readonly AnswerInput[]): ConversationState {
  return inputs.reduce<ConversationState>((state, input) => {
    const result = answer(state, input);
    if ('error' in result) throw new Error(result.error);
    return result.state;
  }, startConversation());
}

function errorOf(state: ConversationState, input: AnswerInput): string {
  const result = answer(state, input);
  if ('error' in result) return result.error;
  throw new Error('expected an error');
}

const SINGLE: readonly AnswerInput[] = [
  { question: 'name', name: 'Residencial Ipê' },
  { question: 'hasBlocks', hasBlocks: false },
  { question: 'shape', floors: 4, perFloor: 4 },
  { question: 'fee', fee: { feeCents: 35000, dueDay: 10 } },
  { question: 'pix', draft: null },
];

const TWO_BLOCKS: readonly AnswerInput[] = [
  { question: 'name', name: 'Residencial Ipê' },
  { question: 'hasBlocks', hasBlocks: true },
  { question: 'blockCount', count: 2 },
  { question: 'blockNames', names: 'A, B' },
];

describe('conversation', () => {
  test('starts by asking the condominium name', () => {
    const state = startConversation();

    expect(state).toEqual({ answers: [], current: 'name', shapeIndex: 0 });
    expect(questionText(state)).toBe('Que condomínio vamos gerenciar hoje?');
  });

  test('single building happy path', () => {
    const state = play(SINGLE);

    expect(state.current).toBe('review');
    expect(questionText(state)).toBe('Tudo certo? Vou montar o Residencial Ipê.');
    expect(toCreateCondoInput(state)).toEqual({
      name: 'Residencial Ipê',
      structure: { blocks: [{ name: null, floors: 4, perFloor: 4 }] },
      monthlyFeeCents: 35000,
      dueDay: 10,
      pix: null,
    });
  });

  test('every answer carries its display text', () => {
    const state = play(SINGLE);

    expect(state.answers.map((item) => item.text)).toEqual([
      'Residencial Ipê',
      'Só um prédio',
      '4 andares, 4 por andar',
      'R$ 350,00, até o dia 10',
      'Depois eu vejo',
    ]);
  });

  test('asks each question with its copy', () => {
    const texts = [
      startConversation(),
      play(SINGLE.slice(0, 1)),
      play(SINGLE.slice(0, 2)),
      play(SINGLE.slice(0, 3)),
      play(SINGLE.slice(0, 4)),
      play(TWO_BLOCKS.slice(0, 2)),
      play(TWO_BLOCKS.slice(0, 3)),
      play(TWO_BLOCKS),
    ].map(questionText);

    expect(texts).toEqual([
      'Que condomínio vamos gerenciar hoje?',
      'Ele tem blocos ou é um prédio só?',
      'Quantos andares, e quantos apartamentos por andar?',
      'Quanto cada apartamento paga por mês, e até que dia?',
      'E pra onde vai o Pix?',
      'Quantos blocos?',
      'Como se chama cada bloco?',
      'Os blocos são iguais?',
    ]);
  });

  test('different blocks ask the shape per block', () => {
    const first = play([...TWO_BLOCKS, { question: 'sameShape', same: false }]);
    const second = play([
      ...TWO_BLOCKS,
      { question: 'sameShape', same: false },
      { question: 'shape', floors: 3, perFloor: 2 },
    ]);
    const done = play([
      ...TWO_BLOCKS,
      { question: 'sameShape', same: false },
      { question: 'shape', floors: 3, perFloor: 2 },
      { question: 'shape', floors: 5, perFloor: 4 },
      { question: 'fee', fee: null },
      { question: 'pix', draft: null },
    ]);

    expect(first).toMatchObject({ current: 'shape', shapeIndex: 0 });
    expect(questionText(first)).toBe(
      'No Bloco A: quantos andares, e quantos apartamentos por andar?',
    );
    expect(second).toMatchObject({ current: 'shape', shapeIndex: 1 });
    expect(questionText(second)).toBe(
      'E o Bloco B: quantos andares, e quantos apartamentos por andar?',
    );
    expect(toCreateCondoInput(done).structure).toEqual({
      blocks: [
        { name: 'A', floors: 3, perFloor: 2 },
        { name: 'B', floors: 5, perFloor: 4 },
      ],
    });
  });

  test('equal blocks ask once and copy the shape', () => {
    const asked = play([...TWO_BLOCKS, { question: 'sameShape', same: true }]);
    const done = play([
      ...TWO_BLOCKS,
      { question: 'sameShape', same: true },
      { question: 'shape', floors: 3, perFloor: 2 },
    ]);

    expect(questionText(asked)).toBe('Quantos andares, e quantos apartamentos por andar?');
    expect(done.current).toBe('fee');
    const final = play([
      ...TWO_BLOCKS,
      { question: 'sameShape', same: true },
      { question: 'shape', floors: 3, perFloor: 2 },
      { question: 'fee', fee: null },
      { question: 'pix', draft: null },
    ]);
    expect(toCreateCondoInput(final).structure).toEqual({
      blocks: [
        { name: 'A', floors: 3, perFloor: 2 },
        { name: 'B', floors: 3, perFloor: 2 },
      ],
    });
  });

  test('rejects 61 floors with a message and keeps the question', () => {
    const state = play(SINGLE.slice(0, 2));

    const result = answer(state, { question: 'shape', floors: 61, perFloor: 4 });

    expect(result).toEqual({ error: 'Informe de 1 a 60 andares.' });
    expect(state.current).toBe('shape');
  });

  test('rejects an invalid apartments-per-floor count', () => {
    expect(errorOf(play(SINGLE.slice(0, 2)), { question: 'shape', floors: 4, perFloor: 21 })).toBe(
      'Informe de 1 a 20 apartamentos por andar.',
    );
  });

  test('rejects more than 2000 apartments across equal blocks', () => {
    const state = play([
      { question: 'name', name: 'Ipê' },
      { question: 'hasBlocks', hasBlocks: true },
      { question: 'blockCount', count: 3 },
      { question: 'blockNames', names: 'A, B, C' },
      { question: 'sameShape', same: true },
    ]);

    expect(errorOf(state, { question: 'shape', floors: 60, perFloor: 20 })).toBe(
      'Use até 2000 apartamentos no total.',
    );
  });

  test('rejects more than 2000 apartments across different blocks', () => {
    const state = play([
      { question: 'name', name: 'Ipê' },
      { question: 'hasBlocks', hasBlocks: true },
      { question: 'blockCount', count: 2 },
      { question: 'blockNames', names: 'A, B' },
      { question: 'sameShape', same: false },
      { question: 'shape', floors: 60, perFloor: 20 },
    ]);

    expect(errorOf(state, { question: 'shape', floors: 60, perFloor: 20 })).toBe(
      'Use até 2000 apartamentos no total.',
    );
  });

  test('rejects a blank or too long name', () => {
    expect(errorOf(startConversation(), { question: 'name', name: '   ' })).toBe(
      'Informe o nome do condomínio.',
    );
    expect(errorOf(startConversation(), { question: 'name', name: 'x'.repeat(81) })).toBe(
      'Use até 80 caracteres.',
    );
  });

  test('rejects a block count outside 2..10', () => {
    const state = play(TWO_BLOCKS.slice(0, 2));

    expect(errorOf(state, { question: 'blockCount', count: 1 })).toBe('Informe de 2 a 10 blocos.');
    expect(errorOf(state, { question: 'blockCount', count: 11 })).toBe('Informe de 2 a 10 blocos.');
    expect(errorOf(state, { question: 'blockCount', count: Number.NaN })).toBe(
      'Informe de 2 a 10 blocos.',
    );
  });

  test('validates the block names', () => {
    const state = play(TWO_BLOCKS.slice(0, 3));

    expect(errorOf(state, { question: 'blockNames', names: 'A' })).toBe(
      'Informe 2 nomes, separados por vírgula.',
    );
    expect(errorOf(state, { question: 'blockNames', names: 'a, A' })).toBe(
      'Os blocos precisam de nomes diferentes.',
    );
    expect(errorOf(state, { question: 'blockNames', names: `A, ${'x'.repeat(31)}` })).toBe(
      'Use até 30 caracteres por nome.',
    );
  });

  test('drops a leading "Bloco " from block names', () => {
    const state = play([
      ...TWO_BLOCKS.slice(0, 3),
      { question: 'blockNames', names: 'Bloco A, bloco B' },
      { question: 'sameShape', same: true },
      { question: 'shape', floors: 2, perFloor: 2 },
      { question: 'fee', fee: null },
      { question: 'pix', draft: null },
    ]);

    expect(toCreateCondoInput(state).structure?.blocks.map((block) => block.name)).toEqual([
      'A',
      'B',
    ]);
    expect(
      errorOf(play(TWO_BLOCKS.slice(0, 3)), { question: 'blockNames', names: 'Bloco A, A' }),
    ).toBe('Os blocos precisam de nomes diferentes.');
    expect(
      'error' in
        answer(play(TWO_BLOCKS.slice(0, 3)), {
          question: 'blockNames',
          names: `A, Bloco ${'x'.repeat(30)}`,
        }),
    ).toBe(false);
  });

  test('suggests letters as block names', () => {
    expect(defaultBlockNames(3)).toBe('A, B, C');
  });

  test('answers a different question with an error', () => {
    expect(errorOf(startConversation(), { question: 'fee', fee: null })).toBe(
      'Responda a pergunta atual.',
    );
  });

  test('validates the fee and the due day', () => {
    const state = play(SINGLE.slice(0, 3));

    expect(errorOf(state, { question: 'fee', fee: { feeCents: 35000, dueDay: 29 } })).toBe(
      'Escolha um dia de 1 a 28.',
    );
    expect(errorOf(state, { question: 'fee', fee: { feeCents: 1_000_000_001, dueDay: 10 } })).toBe(
      'Valor muito alto.',
    );
  });

  test('skipping the fee uses 0 and day 10', () => {
    const state = play([
      ...SINGLE.slice(0, 3),
      { question: 'fee', fee: null },
      { question: 'pix', draft: null },
    ]);

    expect(state.answers[3]?.text).toBe('Depois eu vejo');
    expect(toCreateCondoInput(state)).toMatchObject({ monthlyFeeCents: 0, dueDay: 10 });
  });

  test('normalises a valid Pix key and rejects an invalid one', () => {
    const state = play(SINGLE.slice(0, 4));
    const draft = {
      keyType: 'cpf',
      key: '529.982.247-25',
      receiverName: 'Ipê',
      city: 'Recife',
    } as const;

    const done = play([...SINGLE.slice(0, 4), { question: 'pix', draft }]);

    expect(errorOf(state, { question: 'pix', draft: { ...draft, key: '111' } })).toBe(
      'Chave Pix inválida',
    );
    expect(toCreateCondoInput(done).pix).toEqual({ ...draft, key: '52998224725' });
    expect(done.answers[4]?.text).toBe('CPF · 52998224725');
  });

  test('undo returns to the previous question', () => {
    const state = play(SINGLE.slice(0, 3));

    const back = undo(state);

    expect(back.current).toBe('shape');
    expect(back.answers).toHaveLength(2);
    expect(undo(startConversation())).toEqual(startConversation());
  });

  test('summarises the answers for the review', () => {
    const state = play([
      ...TWO_BLOCKS,
      { question: 'sameShape', same: true },
      { question: 'shape', floors: 3, perFloor: 2 },
      { question: 'fee', fee: null },
      {
        question: 'pix',
        draft: { keyType: 'email', key: 'Sindico@Ipe.com', receiverName: 'Ipê', city: 'Recife' },
      },
    ]);

    expect(reviewSummary(state)).toEqual([
      'Residencial Ipê',
      '2 blocos (A, B) · 12 apartamentos',
      'Mensalidade: depois',
      'Pix: E-mail · sindico@ipe.com',
    ]);
    expect(reviewSummary(play(SINGLE))).toEqual([
      'Residencial Ipê',
      '16 apartamentos',
      'Mensalidade: R$ 350,00, até o dia 10',
      'Pix: depois',
    ]);
  });

  test('restoring re-applies the limits of every answer', () => {
    const blank = { question: 'name', name: '', text: '' } as const;
    const tooManyBlocks = [
      { question: 'name', name: 'Ipê', text: 'Ipê' },
      { question: 'hasBlocks', hasBlocks: true, text: 'Tem blocos' },
      { question: 'blockCount', count: 99, text: '99 blocos' },
    ] as const;
    const badPix = [
      ...play(SINGLE.slice(0, 4)).answers,
      {
        question: 'pix',
        pix: { keyType: 'cpf', key: '111', receiverName: 'Ipê', city: 'Recife' },
        text: 'CPF · 111',
      },
    ] as const;

    expect(restoreConversation([blank])).toBeNull();
    expect(restoreConversation([...tooManyBlocks])).toBeNull();
    expect(restoreConversation([...badPix])).toBeNull();
    expect(restoreConversation(play(SINGLE).answers)).toEqual(play(SINGLE));
    const blocks = play([...TWO_BLOCKS, { question: 'sameShape', same: false }]);
    expect(restoreConversation(blocks.answers)).toEqual(blocks);
  });

  test('pairs every answer with the question it answered', () => {
    const state = play(SINGLE.slice(0, 2));

    expect(transcript(state)).toEqual([
      { question: 'Que condomínio vamos gerenciar hoje?', answer: 'Residencial Ipê' },
      { question: 'Ele tem blocos ou é um prédio só?', answer: 'Só um prédio' },
    ]);
  });

  test('converts to the API input only at the review', () => {
    expect(() => toCreateCondoInput(startConversation())).toThrow('A conversa não terminou');
  });

  test('restores a conversation from its answers and rejects an impossible order', () => {
    const state = play(SINGLE.slice(0, 3));

    expect(restoreConversation(state.answers)).toEqual(state);
    const [first, second] = state.answers;
    const swapped = first && second ? [second, first] : [];
    const extra = { question: 'name', name: 'X', text: 'X' } as const;

    expect(restoreConversation(swapped)).toBeNull();
    expect(restoreConversation([...play(SINGLE).answers, extra])).toBeNull();
  });
});
