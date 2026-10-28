import { z } from 'zod';

import { pixSettingsSchema } from '@/features/settings/domain/pix-settings';

import { condoNameSchema } from './condo-info';

export const MAX_BLOCKS = 10;
export const MAX_FLOORS = 60;
export const MAX_PER_FLOOR = 20;
export const MAX_APARTMENTS = 2000;
export const MAX_BLOCK_NAME = 30;
export const MAX_MONTHLY_FEE_CENTS = 1_000_000_000;
export const MAX_DUE_DAY = 28;
export const DEFAULT_DUE_DAY = 10;

const BLOCK_PREFIX = /^bloco\s+/i;

export function normalizeBlockName(name: string): string {
  return name.trim().replace(BLOCK_PREFIX, '');
}

export const blockSchema = z.object({
  name: z
    .string()
    .transform(normalizeBlockName)
    .pipe(z.string().min(1).max(MAX_BLOCK_NAME))
    .nullable(),
  floors: z.number().int().min(1).max(MAX_FLOORS),
  perFloor: z.number().int().min(1).max(MAX_PER_FLOOR),
});

export type Block = z.output<typeof blockSchema>;

export function apartmentCount(blocks: readonly Pick<Block, 'floors' | 'perFloor'>[]): number {
  return blocks.reduce((sum, block) => sum + block.floors * block.perFloor, 0);
}

export const structureSchema = z
  .object({ blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS) })
  .superRefine(({ blocks }, ctx) => {
    if (blocks.length > 1 && blocks.some((block) => block.name === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cada bloco precisa de um nome.' });
    }
    const names = blocks.map((block) => block.name?.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Os blocos precisam de nomes diferentes.',
      });
    }
    if (apartmentCount(blocks) > MAX_APARTMENTS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Apartamentos demais.' });
    }
  });

export const createCondoInputSchema = z.object({
  name: condoNameSchema,
  structure: structureSchema.optional(),
  monthlyFeeCents: z.number().int().min(0).max(MAX_MONTHLY_FEE_CENTS).default(0),
  dueDay: z.number().int().min(1).max(MAX_DUE_DAY).default(DEFAULT_DUE_DAY),
  pix: pixSettingsSchema.nullable().default(null),
});

export type CreateCondoInput = z.output<typeof createCondoInputSchema>;
