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

export function invitationWhatsappUrl(
  phone: string,
  residentName: string,
  condoName: string,
  link: string,
): string {
  const firstName = residentName.trim().split(/\s+/)[0] ?? '';
  const message = `Olá, ${firstName}! Seu acesso ao ${condoName} no Morada: ${link}`;
  const digits = whatsappDigits(phone);
  return `https://wa.me/${digits ?? ''}?text=${encodeURIComponent(message)}`;
}
