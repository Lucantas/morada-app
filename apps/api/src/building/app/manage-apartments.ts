import { z } from 'zod';

import type { PlacedApartment } from '../domain/building';
import type { BuildingRepository } from '../domain/building-repository';
import { ApartmentOccupiedError, ApartmentValidationError } from '../domain/errors';

const labelSchema = z.string().trim().min(1).max(40);

const addSchema = z.object({
  label: labelSchema,
  block: z.string().trim().min(1).max(30).nullable(),
  floor: z.number().int().min(0).max(200).nullable(),
});

const renameSchema = z.object({ label: labelSchema });

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApartmentValidationError('Dados do apartamento inválidos');
  return result.data;
}

export async function addApartment(
  repo: BuildingRepository,
  input: unknown,
): Promise<PlacedApartment> {
  return repo.add(parse(addSchema, input));
}

export async function renameApartment(
  repo: BuildingRepository,
  id: string,
  input: unknown,
): Promise<PlacedApartment> {
  return repo.rename(id, parse(renameSchema, input).label);
}

export async function deactivateApartment(repo: BuildingRepository, id: string): Promise<void> {
  if (await repo.hasActiveResident(id)) throw new ApartmentOccupiedError();
  await repo.deactivate(id);
}
