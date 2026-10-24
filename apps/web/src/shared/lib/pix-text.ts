const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/g;

export function sanitizePixText(text: string, maxLength: number): string {
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
