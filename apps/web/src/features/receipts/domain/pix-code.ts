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

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '');
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
    field('26', field('00', GUI) + field('01', input.key)),
    field('52', '0000'),
    field('53', '986'),
    amount,
    field('58', 'BR'),
    field('59', stripDiacritics(input.receiverName)),
    field('60', stripDiacritics(input.city)),
    field('62', field('05', input.txid ?? DEFAULT_TXID)),
    '6304',
  ].join('');
  return payload + crc16(payload);
}
