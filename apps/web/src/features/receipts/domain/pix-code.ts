const GUI = 'br.gov.bcb.pix';
const DEFAULT_TXID = '***';
const CRC_POLYNOMIAL = 0x1021;
const CRC_INITIAL = 0xffff;
const CRC_MASK = 0xffff;
const CRC_TOP_BIT = 0x8000;
const BYTE_BITS = 8;
const COMBINING_MARKS = /[̀-ͯ]/g;

export interface BrCodeInput {
  readonly key: string;
  readonly receiverName: string;
  readonly city: string;
  readonly amountCents?: number;
  readonly txid?: string;
}

const MAX_FIELD_LENGTH = 99;
const MAX_NAME_LENGTH = 25;
const MAX_CITY_LENGTH = 15;
const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/g;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

function field(id: string, value: string): string {
  if (value.length > MAX_FIELD_LENGTH) throw new Error(`Pix field ${id} is too long`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function sanitizeText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/º/g, 'o')
    .replace(/ª/g, 'a')
    .replace(NON_PRINTABLE_ASCII, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function requireAscii(value: string, name: string): string {
  if (!PRINTABLE_ASCII.test(value)) throw new Error(`Pix ${name} must be printable ASCII`);
  return value;
}

function crc16(payload: string): string {
  const crc = [...payload].reduce((current, char) => {
    let next = current ^ (char.charCodeAt(0) << BYTE_BITS);
    for (let bit = 0; bit < BYTE_BITS; bit += 1) {
      next = next & CRC_TOP_BIT ? (next << 1) ^ CRC_POLYNOMIAL : next << 1;
      next &= CRC_MASK;
    }
    return next;
  }, CRC_INITIAL);
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function brCode(input: BrCodeInput): string {
  const amount =
    input.amountCents !== undefined && input.amountCents > 0
      ? field('54', (input.amountCents / 100).toFixed(2))
      : '';
  const payload = [
    field('00', '01'),
    field('26', field('00', GUI) + field('01', requireAscii(input.key, 'key'))),
    field('52', '0000'),
    field('53', '986'),
    amount,
    field('58', 'BR'),
    field('59', sanitizeText(input.receiverName, MAX_NAME_LENGTH)),
    field('60', sanitizeText(input.city, MAX_CITY_LENGTH)),
    field('62', field('05', requireAscii(input.txid ?? DEFAULT_TXID, 'txid'))),
    '6304',
  ].join('');
  return payload + crc16(payload);
}
