import { randomInt } from 'node:crypto';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const DEFAULT_LENGTH = 10;

export function generateTempPassword(length: number = DEFAULT_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_ALPHABET[randomInt(SAFE_ALPHABET.length)];
  }
  return out;
}
