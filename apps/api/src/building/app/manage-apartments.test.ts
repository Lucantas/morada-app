import { ApartmentOccupiedError, ApartmentValidationError } from '../domain/errors';
import type { BuildingRepository } from '../domain/building-repository';

import { addApartment, deactivateApartment, renameApartment } from './manage-apartments';

function fakeRepo(overrides: Partial<BuildingRepository> = {}): BuildingRepository {
  return {
    listActive: async () => [],
    add: async (input) => ({ id: 'a-1', position: 1, ...input }),
    rename: async (id, label) => ({ id, label, block: null, floor: null, position: null }),
    deactivate: async () => {},
    hasActiveResident: async () => false,
    ...overrides,
  };
}

describe('manage apartments', () => {
  test('deactivating an occupied apartment throws ApartmentOccupiedError', async () => {
    const deactivate = jest.fn(async () => {});
    const repo = fakeRepo({ hasActiveResident: async () => true, deactivate });

    await expect(deactivateApartment(repo, 'a-1')).rejects.toThrow(ApartmentOccupiedError);
    expect(deactivate).not.toHaveBeenCalled();
  });

  test('deactivating a free apartment deactivates it', async () => {
    const deactivate = jest.fn(async () => {});

    await deactivateApartment(fakeRepo({ deactivate }), 'a-1');

    expect(deactivate).toHaveBeenCalledWith('a-1');
  });

  test('a blank label throws ApartmentValidationError', async () => {
    const repo = fakeRepo();

    await expect(addApartment(repo, { label: '   ', block: null, floor: 1 })).rejects.toThrow(
      ApartmentValidationError,
    );
    await expect(renameApartment(repo, 'a-1', { label: '' })).rejects.toThrow(
      ApartmentValidationError,
    );
  });

  test('rejects an out-of-range floor', async () => {
    await expect(
      addApartment(fakeRepo(), { label: 'Apto 1', block: null, floor: 201 }),
    ).rejects.toThrow(ApartmentValidationError);
  });

  test('adds with trimmed label', async () => {
    const add = jest.fn(
      async (input: { label: string; block: string | null; floor: number | null }) => ({
        id: 'a-1',
        position: 1,
        ...input,
      }),
    );

    const created = await addApartment(fakeRepo({ add }), {
      label: '  Loja  ',
      block: null,
      floor: null,
    });

    expect(add).toHaveBeenCalledWith({ label: 'Loja', block: null, floor: null });
    expect(created.label).toBe('Loja');
  });

  test('renames with trimmed label', async () => {
    const renamed = await renameApartment(fakeRepo(), 'a-1', { label: ' Apto 9 ' });

    expect(renamed.label).toBe('Apto 9');
  });
});
