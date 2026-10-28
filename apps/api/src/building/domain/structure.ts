import { z } from 'zod';

const MAX_BLOCKS = 10;
const MAX_FLOORS = 60;
const MAX_PER_FLOOR = 20;
const MAX_APARTMENTS = 2000;
const POSITION_DIGITS = 2;

const MAX_BLOCK_NAME = 30;
const BLOCK_PREFIX = /^bloco\s+/i;

export function normalizeBlockName(name: string): string {
  return name.trim().replace(BLOCK_PREFIX, '');
}

const blockNameSchema = z
  .string()
  .transform(normalizeBlockName)
  .pipe(z.string().min(1).max(MAX_BLOCK_NAME));

const blockSchema = z.object({
  name: blockNameSchema.nullable(),
  floors: z.number().int().min(1).max(MAX_FLOORS),
  perFloor: z.number().int().min(1).max(MAX_PER_FLOOR),
});

export const structureSchema = z
  .object({ blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS) })
  .superRefine(({ blocks }, ctx) => {
    if (blocks.length > 1 && blocks.some((block) => block.name === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cada bloco precisa de um nome' });
    }
    const names = blocks.map((block) => block.name?.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Os blocos precisam de nomes diferentes',
      });
    }
    const total = blocks.reduce((sum, block) => sum + block.floors * block.perFloor, 0);
    if (total > MAX_APARTMENTS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Apartamentos demais' });
    }
  });

export type Structure = z.output<typeof structureSchema>;

export interface GeneratedApartment {
  label: string;
  block: string | null;
  floor: number;
  position: number;
}

function labelFor(floor: number, position: number, block: string | null): string {
  const base = `Apto ${floor}${String(position).padStart(POSITION_DIGITS, '0')}`;
  return block === null ? base : `${base} · Bloco ${block}`;
}

export function generateApartments(structure: Structure): GeneratedApartment[] {
  return structure.blocks.flatMap(({ name, floors, perFloor }) =>
    Array.from({ length: floors * perFloor }, (_, index) => {
      const floor = Math.floor(index / perFloor) + 1;
      const position = (index % perFloor) + 1;
      return { label: labelFor(floor, position, name), block: name, floor, position };
    }),
  );
}
