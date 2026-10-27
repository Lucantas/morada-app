import { ApiError, type ApiClient } from '@/shared/lib/api-client';

import { BuildingError } from '../domain/errors';

import { HttpBuildingRepository } from './http-building-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpBuildingRepository', () => {
  test('get parses GET /api/building', async () => {
    const building = { blocks: [], unplaced: [] };
    const api = fakeApi({ get: jest.fn().mockResolvedValue(building) });

    const result = await new HttpBuildingRepository(api).get();

    expect(api.get).toHaveBeenCalledWith('/api/building');
    expect(result).toEqual(building);
  });

  test('addApartment POSTs to /api/building/apartments', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(undefined) });
    const input = { label: 'Apto 101', block: null, floor: 1 };

    await new HttpBuildingRepository(api).addApartment(input);

    expect(api.post).toHaveBeenCalledWith('/api/building/apartments', input);
  });

  test('renameApartment PUTs the new label', async () => {
    const api = fakeApi({ put: jest.fn().mockResolvedValue(undefined) });

    await new HttpBuildingRepository(api).renameApartment('a1', 'Apto 102');

    expect(api.put).toHaveBeenCalledWith('/api/building/apartments/a1', { label: 'Apto 102' });
  });

  test('deactivateApartment POSTs to the deactivate path', async () => {
    const api = fakeApi({ post: jest.fn().mockResolvedValue(undefined) });

    await new HttpBuildingRepository(api).deactivateApartment('a1');

    expect(api.post).toHaveBeenCalledWith('/api/building/apartments/a1/deactivate');
  });

  test.each([
    [404, 'Apartamento não encontrado', 'not_found'],
    [409, 'Apartamento com morador ativo', 'conflict'],
    [400, 'Dados inválidos', 'invalid'],
    [500, 'Erro 500', 'unavailable'],
  ])('maps API status %i to a BuildingError', async (status, message, kind) => {
    const api = fakeApi({ post: jest.fn().mockRejectedValue(new ApiError(status, message)) });

    const error = await new HttpBuildingRepository(api).deactivateApartment('a1').catch((e) => e);

    expect(error).toBeInstanceOf(BuildingError);
    expect(error).toMatchObject({ kind, message });
  });

  test('maps a network failure to unavailable', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new TypeError('fetch failed')) });

    const error = await new HttpBuildingRepository(api).get().catch((e) => e);

    expect(error).toMatchObject({ kind: 'unavailable' });
  });
});
