import {
  confirmEmailLink,
  confirmEmailMessage,
  invitationLink,
  invitationMessage,
  resetPasswordLink,
  resetPasswordMessage,
  signupAttemptMessage,
} from './emails';

describe('e-mail templates', () => {
  test('builds hash-router links from the app url', () => {
    expect(confirmEmailLink('https://app.x', 'tok')).toBe('https://app.x/#/confirmar-email/tok');
    expect(resetPasswordLink('https://app.x', 'tok')).toBe('https://app.x/#/redefinir-senha/tok');
    expect(invitationLink('https://app.x', 'tok')).toBe('https://app.x/#/convite/tok');
  });

  test('confirmation uses the exact subject and carries the link in both bodies', () => {
    const message = confirmEmailMessage('ana@x.com', 'https://app.x/#/confirmar-email/tok');
    expect(message.to).toBe('ana@x.com');
    expect(message.subject).toBe('Confirme seu e-mail no Morada');
    expect(message.text).toContain('https://app.x/#/confirmar-email/tok');
    expect(message.html).toContain('href="https://app.x/#/confirmar-email/tok"');
  });

  test('reset uses the exact subject', () => {
    expect(resetPasswordMessage('ana@x.com', 'https://l').subject).toBe(
      'Redefinição de senha do Morada',
    );
  });

  test('sign-up attempt links to the reset flow', () => {
    const message = signupAttemptMessage('ana@x.com', 'https://l/reset');
    expect(message.text).toContain('https://l/reset');
    expect(message.subject).not.toBe('Confirme seu e-mail no Morada');
  });

  test('invitation subject names the condominium and the html is escaped', () => {
    const message = invitationMessage('ana@x.com', 'Bloco <2> & Cia', 'https://l/convite');
    expect(message.subject).toBe('Você foi convidado para o Bloco <2> & Cia');
    expect(message.html).toContain('Bloco &lt;2&gt; &amp; Cia');
    expect(message.html).not.toContain('<2>');
  });
});
