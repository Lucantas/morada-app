import { invitationErrorKind, type InvitationErrorKind } from '../domain/errors';

type Messages = Partial<Record<InvitationErrorKind, string>>;

export const INVALID_INVITATION =
  'Convite inválido ou expirado. Peça um novo convite ao administrador.';

const SHARED: Messages = {
  'invalid-invitation': INVALID_INVITATION,
  'invalid-credentials': 'Senha incorreta.',
  'invalid-input': 'Confira os dados informados.',
  'rate-limited': 'Muitas tentativas, tente mais tarde.',
  'inactive-resident': 'Este morador não está mais ativo no apartamento.',
  'pending-conflict': 'Já existe um convite pendente. Atualize a tela.',
  'not-found': 'Morador não encontrado.',
  'email-unavailable': 'Envio de e-mail indisponível. Tente mais tarde.',
};

const CONNECTION = 'Não foi possível concluir. Verifique a conexão com o servidor.';

export function invitationErrorMessage(error: unknown, messages: Messages = {}): string {
  const kind = invitationErrorKind(error);
  return messages[kind] ?? SHARED[kind] ?? CONNECTION;
}
