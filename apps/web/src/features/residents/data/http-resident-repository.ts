import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

import { residentSchema, type Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

const residentListSchema = z.array(residentSchema);

export class HttpResidentRepository implements ResidentRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Resident[]> {
    return residentListSchema.parse(await this.api.get('/api/residents'));
  }

  async getById(id: string): Promise<Resident | null> {
    try {
      return residentSchema.parse(await this.api.get(`/api/residents/${id}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  // The server resolves the current resident from the JWT subject, so the
  // subject argument is unused here (kept to satisfy the repository interface).
  async getCurrent(): Promise<Resident | null> {
    try {
      return residentSchema.parse(await this.api.get('/api/residents/me'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async save(resident: Resident): Promise<Resident> {
    // PUT upserts by the (client-generated) id, so create and update share a path.
    return residentSchema.parse(await this.api.put(`/api/residents/${resident.id}`, resident));
  }
}
