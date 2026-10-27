import { ApartmentConflictError, ApartmentNotFoundError } from '../domain/errors';
import type { BuildingRepository } from '../domain/building-repository';

export interface BuildingProbe {
  occupy(apartmentId: string): Promise<void>;
}

export function runBuildingRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<BuildingRepository>,
  probe: BuildingProbe,
): void {
  describe(label, () => {
    test('add places at the next position', async () => {
      const repo = await makeRepo('condo-a');

      const first = await repo.add({ label: 'Apto 301', block: null, floor: 3 });
      const second = await repo.add({ label: 'Apto 302', block: null, floor: 3 });
      const otherBlock = await repo.add({ label: 'Apto 301 · Bloco A', block: 'A', floor: 3 });

      expect([first.position, second.position, otherBlock.position]).toEqual([1, 2, 1]);
      expect(second).toMatchObject({ label: 'Apto 302', block: null, floor: 3 });
    });

    test('add without a floor leaves the apartment unplaced', async () => {
      const repo = await makeRepo('condo-a');

      const loja = await repo.add({ label: 'Loja', block: null, floor: null });

      expect(loja).toMatchObject({ floor: null, position: null });
    });

    test('add with an active label conflicts', async () => {
      const repo = await makeRepo('condo-a');
      await repo.add({ label: 'Apto 101', block: null, floor: 1 });

      await expect(repo.add({ label: 'Apto 101', block: null, floor: 1 })).rejects.toThrow(
        ApartmentConflictError,
      );
    });

    test('rename to an existing label conflicts', async () => {
      const repo = await makeRepo('condo-a');
      await repo.add({ label: 'Apto 101', block: null, floor: 1 });
      const other = await repo.add({ label: 'Apto 102', block: null, floor: 1 });

      await expect(repo.rename(other.id, 'Apto 101')).rejects.toThrow(ApartmentConflictError);
    });

    test('rename changes the label', async () => {
      const repo = await makeRepo('condo-a');
      const apt = await repo.add({ label: 'Apto 101', block: null, floor: 1 });

      const renamed = await repo.rename(apt.id, 'Cobertura');

      expect(renamed).toMatchObject({ id: apt.id, label: 'Cobertura', floor: 1, position: 1 });
    });

    test('deactivated apartments leave listActive', async () => {
      const repo = await makeRepo('condo-a');
      const apt = await repo.add({ label: 'Apto 101', block: null, floor: 1 });

      await repo.deactivate(apt.id);

      expect(await repo.listActive()).toEqual([]);
    });

    test('add with a deactivated label reactivates and places it', async () => {
      const repo = await makeRepo('condo-a');
      const apt = await repo.add({ label: 'Apto 101', block: null, floor: 1 });
      await repo.deactivate(apt.id);

      const again = await repo.add({ label: 'Apto 101', block: 'A', floor: 2 });

      expect(again).toMatchObject({ id: apt.id, block: 'A', floor: 2, position: 1 });
      expect((await repo.listActive()).map((a) => a.id)).toEqual([apt.id]);
    });

    test('hasActiveResident reflects the occupancy', async () => {
      const repo = await makeRepo('condo-a');
      const apt = await repo.add({ label: 'Apto 101', block: null, floor: 1 });
      expect(await repo.hasActiveResident(apt.id)).toBe(false);

      await probe.occupy(apt.id);

      expect(await repo.hasActiveResident(apt.id)).toBe(true);
    });

    test('another condominium cannot see or change the apartment', async () => {
      const repo = await makeRepo('condo-a');
      const other = await makeRepo('condo-b');
      const apt = await repo.add({ label: 'Apto 101', block: null, floor: 1 });

      expect(await other.listActive()).toEqual([]);
      await expect(other.rename(apt.id, 'Invadido')).rejects.toThrow(ApartmentNotFoundError);
      await expect(other.deactivate(apt.id)).rejects.toThrow(ApartmentNotFoundError);
      expect(await other.hasActiveResident(apt.id)).toBe(false);
    });

    test('the same label can exist in two condominiums', async () => {
      const a = await makeRepo('condo-a');
      const b = await makeRepo('condo-b');

      await a.add({ label: 'Apto 101', block: null, floor: 1 });
      const second = await b.add({ label: 'Apto 101', block: null, floor: 1 });

      expect(second.label).toBe('Apto 101');
    });
  });
}
