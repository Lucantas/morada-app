import { z } from 'zod';

import { normalizeEmail } from '../../users/domain/email';

export const PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

const INVALID_KEY = 'Chave Pix inválida';
const RECEIVER_MESSAGE = 'Informe o nome do recebedor (até 25 caracteres)';
const CITY_MESSAGE = 'Informe a cidade (até 15 caracteres)';

const MAX_EMAIL_LENGTH = 77;
const BR_COUNTRY_CODE = '55';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = z.string().email();

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '');
}

function checkDigit(digits: readonly number[], weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + weight * (digits[index] ?? 0), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

interface DocumentWeights {
  readonly first: readonly number[];
  readonly second: readonly number[];
}

const CPF_WEIGHTS: DocumentWeights = {
  first: [10, 9, 8, 7, 6, 5, 4, 3, 2],
  second: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
};
const CNPJ_WEIGHTS: DocumentWeights = {
  first: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  second: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
};

function hasValidCheckDigits(digits: string, weights: DocumentWeights): boolean {
  const numbers = [...digits].map(Number);
  return (
    checkDigit(numbers, weights.first) === numbers[weights.first.length] &&
    checkDigit(numbers, weights.second) === numbers[weights.second.length]
  );
}

function normalizeCpf(raw: string): string | null {
  const digits = digitsOf(raw);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return null;
  return hasValidCheckDigits(digits, CPF_WEIGHTS) ? digits : null;
}

function normalizeCnpj(raw: string): string | null {
  const digits = digitsOf(raw);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return null;
  return hasValidCheckDigits(digits, CNPJ_WEIGHTS) ? digits : null;
}

function normalizeEmailKey(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (email.length > MAX_EMAIL_LENGTH) return null;
  return EMAIL_PATTERN.safeParse(email).success ? email : null;
}

function normalizePhone(raw: string): string | null {
  const digits = digitsOf(raw);
  const national =
    (digits.length === 12 || digits.length === 13) && digits.startsWith(BR_COUNTRY_CODE)
      ? digits.slice(BR_COUNTRY_CODE.length)
      : digits;
  return /^\d{10,11}$/.test(national) ? `+${BR_COUNTRY_CODE}${national}` : null;
}

function normalizeRandomKey(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return UUID_PATTERN.test(key) ? key : null;
}

const NORMALIZERS: Record<PixKeyType, (raw: string) => string | null> = {
  cpf: normalizeCpf,
  cnpj: normalizeCnpj,
  email: normalizeEmailKey,
  telefone: normalizePhone,
  aleatoria: normalizeRandomKey,
};

export const pixSettingsSchema = z
  .object({
    keyType: z.enum(PIX_KEY_TYPES, { message: INVALID_KEY }),
    key: z.string({ message: INVALID_KEY }),
    receiverName: z
      .string({ message: RECEIVER_MESSAGE })
      .trim()
      .min(1, RECEIVER_MESSAGE)
      .max(25, RECEIVER_MESSAGE),
    city: z.string({ message: CITY_MESSAGE }).trim().min(1, CITY_MESSAGE).max(15, CITY_MESSAGE),
  })
  .transform((value, ctx) => {
    const key = NORMALIZERS[value.keyType](value.key);
    if (key === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: INVALID_KEY, path: ['key'] });
      return z.NEVER;
    }
    return { ...value, key };
  });

export type PixSettings = z.output<typeof pixSettingsSchema>;
