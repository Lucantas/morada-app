import type { EmailMessage } from '../../platform/email/email-sender';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function compose(to: string, subject: string, intro: string, action: string, link: string) {
  const text = `${intro}\n\n${action}: ${link}\n\nSe você não esperava este e-mail, pode ignorá-lo.`;
  const html = `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p><p>Se você não esperava este e-mail, pode ignorá-lo.</p>`;
  return { to, subject, text, html } satisfies EmailMessage;
}

export function confirmEmailLink(appUrl: string, token: string): string {
  return `${appUrl}/#/confirmar-email/${token}`;
}

export function resetPasswordLink(appUrl: string, token: string): string {
  return `${appUrl}/#/redefinir-senha/${token}`;
}

export function invitationLink(appUrl: string, token: string): string {
  return `${appUrl}/#/convite/${token}`;
}

export function confirmEmailMessage(to: string, link: string): EmailMessage {
  return compose(
    to,
    'Confirme seu e-mail no Morada',
    'Bem-vindo ao Morada! Confirme seu e-mail para ativar sua conta. O link vale por 24 horas. Se não foi você, ignore este e-mail.',
    'Confirmar e-mail',
    link,
  );
}

export function signupAttemptMessage(to: string, resetLink: string): EmailMessage {
  return compose(
    to,
    'Alguém tentou criar uma conta com seu e-mail no Morada',
    'Alguém tentou criar uma conta no Morada com este e-mail, mas você já tem uma conta. Se foi você e esqueceu a senha, redefina-a pelo link abaixo. O link vale por 1 hora.',
    'Redefinir senha',
    resetLink,
  );
}

export function resetPasswordMessage(to: string, link: string): EmailMessage {
  return compose(
    to,
    'Redefinição de senha do Morada',
    'Recebemos um pedido para redefinir a senha da sua conta no Morada. O link vale por 1 hora.',
    'Redefinir senha',
    link,
  );
}

export function invitationMessage(to: string, condoName: string, link: string): EmailMessage {
  return compose(
    to,
    `Você foi convidado para o ${condoName}`,
    `Você foi convidado para participar do ${condoName} no Morada. O convite vale por 7 dias.`,
    'Aceitar convite',
    link,
  );
}

export function sindicoInvitationMessage(
  to: string,
  condoName: string,
  link: string,
): EmailMessage {
  return compose(
    to,
    `Você foi convidado para ser síndico do ${condoName}`,
    `Você foi convidado para ser síndico do ${condoName} no Morada. O convite vale por 7 dias.`,
    'Aceitar convite',
    link,
  );
}

export function membroInvitationMessage(
  to: string,
  organizationName: string,
  link: string,
): EmailMessage {
  return compose(
    to,
    `Você foi convidado para a equipe ${organizationName}`,
    `Você foi convidado para a equipe ${organizationName} no Morada. O convite vale por 7 dias.`,
    'Aceitar convite',
    link,
  );
}
