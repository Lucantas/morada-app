import { invitationWhatsappUrl } from './whatsapp';

const LINK = 'https://app.test/#/convite/tok';
const message = (name: string) => `Olá, ${name}! Seu acesso ao Morada Bloco 2 no Morada: ${LINK}`;

describe('invitationWhatsappUrl', () => {
  test('adds the country code to a formatted national number', () => {
    expect(invitationWhatsappUrl('(11) 98888-7777', 'Maria Ribeiro', 'Morada Bloco 2', LINK)).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent(message('Maria'))}`,
    );
  });

  test('accepts a ten digit landline', () => {
    expect(invitationWhatsappUrl('11 3888-7777', 'Maria', 'Morada Bloco 2', LINK)).toContain(
      'https://wa.me/551138887777?text=',
    );
  });

  test.each(['+55 11 98888-7777', '5511988887777', '551138887777'])(
    'keeps a number that already has the country code: %s',
    (phone) => {
      const url = invitationWhatsappUrl(phone, 'Maria', 'Morada Bloco 2', LINK);
      expect(url).toMatch(/^https:\/\/wa\.me\/55\d{10,11}\?text=/);
    },
  );

  test.each(['', '   ', '12345', '+1 415 555 2671 99', '445511988887777'])(
    'falls back to the generic link for an unusable phone: "%s"',
    (phone) => {
      expect(invitationWhatsappUrl(phone, 'Maria', 'Morada Bloco 2', LINK)).toBe(
        `https://wa.me/?text=${encodeURIComponent(message('Maria'))}`,
      );
    },
  );

  test('greets with the first word of the name', () => {
    expect(invitationWhatsappUrl('', '  João   Pereira ', 'Morada Bloco 2', LINK)).toContain(
      encodeURIComponent('Olá, João!'),
    );
  });
});
