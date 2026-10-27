import { answer, startConversation, type ConversationState } from '../domain/conversation';

import { DRAFT_KEY, clearDraft, loadDraft, localDraftStore, saveDraft } from './local-draft-store';

function namedDraft(): ConversationState {
  const result = answer(startConversation(), { question: 'name', name: 'Residencial Ipê' });
  if ('error' in result) throw new Error(result.error);
  return result.state;
}

describe('local draft store', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  test('round-trips a draft', () => {
    const draft = namedDraft();

    saveDraft(draft);

    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(loadDraft()).toEqual(draft);
  });

  test('gives null without a draft', () => {
    expect(loadDraft()).toBeNull();
  });

  test('corrupt JSON gives null', () => {
    window.localStorage.setItem(DRAFT_KEY, '{not json');

    expect(loadDraft()).toBeNull();
  });

  test('a draft with an unknown shape gives null', () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: [{ question: 'x' }] }));

    expect(loadDraft()).toBeNull();
  });

  test('a draft whose answers are out of order gives null', () => {
    const answers = [{ question: 'hasBlocks', hasBlocks: false, text: 'Só um prédio' }];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers }));

    expect(loadDraft()).toBeNull();
  });

  test('a draft with out-of-limit values gives null', () => {
    const answers = [
      { question: 'name', name: 'Ipê', text: 'Ipê' },
      { question: 'hasBlocks', hasBlocks: false, text: 'Só um prédio' },
      { question: 'shape', floors: 999, perFloor: 4, text: '999 andares, 4 por andar' },
    ];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers }));

    expect(loadDraft()).toBeNull();
  });

  test('a draft whose block names do not match the block count gives null', () => {
    const answers = [
      { question: 'name', name: 'Ipê', text: 'Ipê' },
      { question: 'hasBlocks', hasBlocks: true, text: 'Tem blocos' },
      { question: 'blockCount', count: 3, text: '3 blocos' },
      { question: 'blockNames', names: ['A', 'B'], text: 'A, B' },
      { question: 'sameShape', same: false, text: 'Não' },
    ];
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers }));

    expect(loadDraft()).toBeNull();
  });

  test('clears the draft', () => {
    saveDraft(namedDraft());

    clearDraft();

    expect(loadDraft()).toBeNull();
  });

  test('throwing storage gives null and does not throw', () => {
    const broken = () => {
      throw new Error('blocked');
    };
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(broken);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(broken);
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(broken);

    expect(loadDraft()).toBeNull();
    expect(() => saveDraft(namedDraft())).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
  });

  test('exposes the functions as a draft store', () => {
    expect(localDraftStore).toEqual({ load: loadDraft, save: saveDraft, clear: clearDraft });
  });
});
