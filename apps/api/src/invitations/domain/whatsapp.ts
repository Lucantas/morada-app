const COUNTRY_CODE = '55';
const NATIONAL_LENGTHS = [10, 11];
const INTERNATIONAL_LENGTHS = [12, 13];

function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (NATIONAL_LENGTHS.includes(digits.length)) return `${COUNTRY_CODE}${digits}`;
  if (INTERNATIONAL_LENGTHS.includes(digits.length) && digits.startsWith(COUNTRY_CODE)) {
    return digits;
  }
  return null;
}

function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${whatsappDigits(phone) ?? ''}?text=${encodeURIComponent(message)}`;
}

export function invitationWhatsappUrl(
  phone: string,
  residentName: string,
  condoName: string,
  link: string,
): string {
  const firstName = residentName.trim().split(/\s+/)[0] ?? '';
  return whatsappUrl(phone, `Olá, ${firstName}! Seu acesso ao ${condoName} no Morada: ${link}`);
}

export function sindicoInvitationWhatsappUrl(
  phone: string,
  condoName: string,
  link: string,
): string {
  return whatsappUrl(
    phone,
    `Olá! Você foi convidado para ser síndico do ${condoName} no Morada: ${link}`,
  );
}

export function membroInvitationWhatsappUrl(
  phone: string,
  organizationName: string,
  link: string,
): string {
  return whatsappUrl(
    phone,
    `Olá! Você foi convidado para a equipe ${organizationName} no Morada: ${link}`,
  );
}
