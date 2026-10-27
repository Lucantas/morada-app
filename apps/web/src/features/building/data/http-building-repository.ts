import { ApiError, type ApiClient } from '@/shared/lib/api-client';

import { buildingSchema, type Building } from '../domain/building';
import type { BuildingRepository, NewApartment } from '../domain/building-repository';
import { BuildingError, type BuildingErrorKind } from '../domain/errors';

const KIND_BY_STATUS: Readonly<Record<number, BuildingErrorKind>> = {
  400: 'invalid',
  404: 'not_found',
  409: 'conflict',
};

function toBuildingError(error: unknown): Error {
  if (error instanceof ApiError) {
    return new BuildingError(KIND_BY_STATUS[error.status] ?? 'unavailable', error.message);
  }
  return new BuildingError('unavailable', 'Não foi possível falar com o servidor');
}

async function guarded<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw toBuildingError(error);
  }
}

export class HttpBuildingRepository implements BuildingRepository {
  constructor(private readonly api: ApiClient) {}

  get(): Promise<Building> {
    return guarded(async () => buildingSchema.parse(await this.api.get('/api/building')));
  }

  async addApartment(input: NewApartment): Promise<void> {
    await guarded(() => this.api.post('/api/building/apartments', input));
  }

  async renameApartment(id: string, label: string): Promise<void> {
    await guarded(() => this.api.put(`/api/building/apartments/${id}`, { label }));
  }

  async deactivateApartment(id: string): Promise<void> {
    await guarded(() => this.api.post(`/api/building/apartments/${id}/deactivate`));
  }
}
