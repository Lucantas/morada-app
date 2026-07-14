import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';
import { buildResident } from '@/test/factories';

import { HttpResidentRepository } from './http-resident-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpResidentRepository', () => {
  test('list parses the GET /api/residents response', async () => {
    const resident = buildResident({ id: 'r-1' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([resident]) });

    const result = await new HttpResidentRepository(api).list();

    expect(api.get).toHaveBeenCalledWith('/api/residents');
    expect(result).toEqual([resident]);
  });

  test('getById returns null on a 404', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(404, 'não encontrado')) });

    expect(await new HttpResidentRepository(api).getById('nope')).toBeNull();
  });

  test('listByApartment parses the apartment occupant-history response', async () => {
    const resident = buildResident({ id: 'r-1', apartmentId: 'apt-9' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([resident]) });

    const result = await new HttpResidentRepository(api).listByApartment('apt-9');

    expect(api.get).toHaveBeenCalledWith('/api/apartments/apt-9/residents');
    expect(result).toEqual([resident]);
  });

  test('getById rethrows non-404 errors', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(500, 'boom')) });

    await expect(new HttpResidentRepository(api).getById('x')).rejects.toBeInstanceOf(ApiError);
  });

  test('save PUTs to the id-scoped path (upsert)', async () => {
    const resident = buildResident({ id: 'r-9', name: 'Ana' });
    const api = fakeApi({ put: jest.fn().mockResolvedValue(resident) });

    const result = await new HttpResidentRepository(api).save(resident);

    expect(api.put).toHaveBeenCalledWith('/api/residents/r-9', resident);
    expect(result).toEqual(resident);
  });
});
