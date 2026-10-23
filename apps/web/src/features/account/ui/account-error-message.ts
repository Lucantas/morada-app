import { accountErrorKind, type AccountErrorKind } from '../domain/errors';

type Messages = Partial<Record<AccountErrorKind, string>>;

const SHARED: Messages = {
  'rate-limited': 'Muitas tentativas, tente mais tarde.',
  'email-unavailable': 'Envio de e-mail indisponível. Tente mais tarde.',
  'email-not-confirmed': 'Confirme seu e-mail antes de criar um condomínio.',
};

const CONNECTION = 'Não foi possível concluir. Verifique a conexão com o servidor.';

export function accountErrorMessage(error: unknown, messages: Messages = {}): string {
  const kind = accountErrorKind(error);
  return messages[kind] ?? SHARED[kind] ?? CONNECTION;
}

export function loginErrorMessage(error: unknown): string {
  return accountErrorMessage(error, {
    'invalid-credentials': 'Usuário ou senha inválidos.',
    unavailable: 'Não foi possível entrar. Verifique a conexão com o servidor.',
    'invalid-input': 'Usuário ou senha inválidos.',
  });
}
