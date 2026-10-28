import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthError } from '@/features/auth/domain/errors';
import { CREATED_CONDO, fakeAuthRepository } from '@/test/factories.auth';
import { renderWithClient } from '@/test/render';

import {
  answer,
  startConversation,
  type AnswerInput,
  type ConversationState,
} from '../domain/conversation';
import type { DraftStore } from '../domain/draft-store';

import { ConversationScreen } from './conversation-screen';

function play(inputs: readonly AnswerInput[]): ConversationState {
  return inputs.reduce<ConversationState>((state, input) => {
    const result = answer(state, input);
    if ('error' in result) throw new Error(result.error);
    return result.state;
  }, startConversation());
}

function fakeDrafts(initial: ConversationState | null = null): jest.Mocked<DraftStore> {
  return { load: jest.fn(() => initial), save: jest.fn(), clear: jest.fn() };
}

function renderScreen(drafts = fakeDrafts(), repository = fakeAuthRepository()) {
  const props = { repository, drafts, onCreated: jest.fn(), onSignOut: jest.fn() };
  renderWithClient(<ConversationScreen {...props} />);
  return props;
}

const AT_FEE: readonly AnswerInput[] = [
  { question: 'name', name: 'Residencial Ipê' },
  { question: 'hasBlocks', hasBlocks: false },
  { question: 'shape', floors: 4, perFloor: 4 },
];

describe('ConversationScreen', () => {
  test('asks the condominium name first', () => {
    renderScreen();

    expect(screen.getByText('Que condomínio vamos gerenciar hoje?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument();
  });

  test('resumes from a saved draft', () => {
    renderScreen(fakeDrafts(play(AT_FEE)));

    expect(screen.getByText('Residencial Ipê')).toBeInTheDocument();
    expect(
      screen.getByText('Quanto cada apartamento paga por mês, e até que dia?'),
    ).toBeInTheDocument();
  });

  test('creates the condominium', async () => {
    const { repository, drafts, onCreated } = renderScreen();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nome do condomínio'), 'Residencial Ipê');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(screen.getByRole('button', { name: 'Tem blocos' }));
    await user.type(screen.getByLabelText('Quantos blocos'), '2');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(screen.getByRole('button', { name: 'A, B, C…' }));
    await user.click(screen.getByRole('button', { name: 'Sim' }));
    await user.type(screen.getByLabelText('Andares'), '4');
    await user.type(screen.getByLabelText('Apartamentos por andar'), '4');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.type(screen.getByLabelText('Valor por mês'), '35000');
    await user.clear(screen.getByLabelText('Dia do vencimento'));
    await user.type(screen.getByLabelText('Dia do vencimento'), '5');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.selectOptions(screen.getByLabelText('Tipo de chave'), 'cpf');
    await user.type(screen.getByLabelText('Chave Pix'), '529.982.247-25');
    await user.type(screen.getByLabelText('Nome do recebedor'), 'Residencial Ipe');
    await user.type(screen.getByLabelText('Cidade'), 'Recife');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(screen.getByText('Tudo certo? Vou montar o Residencial Ipê.')).toBeInTheDocument();
    expect(screen.getByText('2 blocos (A, B) · 32 apartamentos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar o Residencial Ipê' }));

    expect(repository.createCondo).toHaveBeenCalledWith({
      name: 'Residencial Ipê',
      structure: {
        blocks: [
          { name: 'A', floors: 4, perFloor: 4 },
          { name: 'B', floors: 4, perFloor: 4 },
        ],
      },
      monthlyFeeCents: 35000,
      dueDay: 5,
      pix: { keyType: 'cpf', key: '52998224725', receiverName: 'Residencial Ipe', city: 'Recife' },
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED_CONDO));
    expect(drafts.clear).toHaveBeenCalled();
  });

  test('saves the draft after each answer', async () => {
    const { drafts } = renderScreen();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nome do condomínio'), 'Residencial Ipê');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(drafts.save).toHaveBeenLastCalledWith(expect.objectContaining({ current: 'hasBlocks' }));
  });

  test('shows a validation error and keeps the question', async () => {
    renderScreen(fakeDrafts(play(AT_FEE.slice(0, 2))));
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Andares'), '61');
    await user.type(screen.getByLabelText('Apartamentos por andar'), '4');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe de 1 a 60 andares.');
    expect(
      screen.getByText('Quantos andares, e quantos apartamentos por andar?'),
    ).toBeInTheDocument();
  });

  test('corrects the last answer', async () => {
    renderScreen(fakeDrafts(play(AT_FEE)));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Corrigir' }));

    expect(screen.queryByText('4 andares, 4 por andar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Andares')).toBeInTheDocument();
  });

  test('skips the fee and the Pix', async () => {
    const { repository } = renderScreen(fakeDrafts(play(AT_FEE)));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(screen.getByRole('button', { name: 'Depois eu vejo' }));
    await user.click(screen.getByRole('button', { name: 'Criar o Residencial Ipê' }));

    expect(repository.createCondo).toHaveBeenCalledWith(
      expect.objectContaining({ monthlyFeeCents: 0, dueDay: 10, pix: null }),
    );
  });

  test('answers a single building with typed names and different blocks', async () => {
    renderScreen(
      fakeDrafts(
        play([
          { question: 'name', name: 'Ipê' },
          { question: 'hasBlocks', hasBlocks: true },
          { question: 'blockCount', count: 2 },
        ]),
      ),
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Nomes dos blocos'), 'Norte, Sul');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await user.click(screen.getByRole('button', { name: 'Não' }));

    expect(
      screen.getByText('No Bloco Norte: quantos andares, e quantos apartamentos por andar?'),
    ).toBeInTheDocument();
  });

  test('explains a failed creation', async () => {
    const repository = fakeAuthRepository({
      createCondo: jest.fn().mockRejectedValue(new AuthError('email-not-confirmed')),
    });
    const drafts = fakeDrafts(
      play([...AT_FEE, { question: 'fee', fee: null }, { question: 'pix', draft: null }]),
    );
    renderScreen(drafts, repository);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Criar o Residencial Ipê' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirme seu e-mail antes de criar um condomínio.',
    );
    expect(drafts.clear).not.toHaveBeenCalled();
  });

  test('explains an unavailable server', async () => {
    const repository = fakeAuthRepository({
      createCondo: jest.fn().mockRejectedValue(new AuthError('unavailable')),
    });
    renderScreen(
      fakeDrafts(
        play([...AT_FEE, { question: 'fee', fee: null }, { question: 'pix', draft: null }]),
      ),
      repository,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Criar o Residencial Ipê' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar o condomínio. Tente novamente.',
    );
  });

  test('hides Corrigir and Sair while the condominium is being created', async () => {
    const repository = fakeAuthRepository({
      createCondo: jest.fn().mockReturnValue(new Promise<never>(() => undefined)),
    });
    renderScreen(
      fakeDrafts(
        play([...AT_FEE, { question: 'fee', fee: null }, { question: 'pix', draft: null }]),
      ),
      repository,
    );
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Corrigir' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Criar o Residencial Ipê' }));

    expect(await screen.findByRole('button', { name: 'Criando…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Corrigir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    expect(repository.createCondo).toHaveBeenCalledTimes(1);
  });

  test('signs out', async () => {
    const { onSignOut } = renderScreen();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(onSignOut).toHaveBeenCalled();
  });
});
