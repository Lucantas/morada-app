import { ApartmentOccupiedError, ResidentNotFoundError } from '../domain/errors';
import type { ResidentRepository } from '../domain/resident-repository';

const maria = {
  id: 'r-1',
  name: 'Maria Ribeiro',
  apt: 'Apto 302',
  phone: '9',
  email: 'a@b.c',
  status: 'em_dia' as const,
};

// Behavioural contract every ResidentRepository must satisfy, run against both
// the SQLite and Postgres adapters so the two stores stay in lockstep.
export interface ApartmentProbe {
  read(apartmentId: string): Promise<{
    floor: number | null;
    position: number | null;
    block: string | null;
    active: boolean;
  }>;
  deactivate(apartmentId: string): Promise<void>;
}

export function runResidentRepositoryContract(
  label: string,
  makeRepo: (condominiumId: string) => Promise<ResidentRepository>,
  probe: ApartmentProbe,
): void {
  const readApartment = probe.read;
  const deactivateApartment = probe.deactivate;
  describe(label, () => {
    test('save creates the apartment + active occupancy and getById joins them', async () => {
      const repo = await makeRepo('condo-a');
      const saved = await repo.save(maria);

      expect(saved).toMatchObject({
        id: 'r-1',
        name: 'Maria Ribeiro',
        apt: 'Apto 302',
        active: true,
      });
      expect(saved.apartmentId).toMatch(/.+/);
      expect(await repo.getById('r-1')).toEqual(saved);
    });

    test("saving a resident on a new 'Apto 501' places it", async () => {
      const repo = await makeRepo('condo-a');

      const saved = await repo.save({ ...maria, apt: 'Apto 501' });

      const { floor, position, block } = await readApartment(saved.apartmentId);
      expect({ floor, position, block }).toEqual({ floor: 5, position: 1, block: null });
    });

    test("saving on a deactivated apartment's label reactivates it", async () => {
      const repo = await makeRepo('condo-a');
      const first = await repo.save(maria);
      await repo.deactivate('r-1');
      await deactivateApartment(first.apartmentId);

      const next = await repo.save({ ...maria, id: 'r-9', name: 'Ana' });

      expect(next.apartmentId).toBe(first.apartmentId);
      expect((await readApartment(first.apartmentId)).active).toBe(true);
    });

    test('reuses the apartment for the same label', async () => {
      const repo = await makeRepo('condo-a');
      const first = await repo.save(maria);
      await repo.deactivate('r-1');
      const next = await repo.save({ ...maria, id: 'r-9', name: 'Ana' });
      expect(next.apartmentId).toBe(first.apartmentId);
    });

    test('rejects a second active resident in the same apartment', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(maria);
      await expect(repo.save({ ...maria, id: 'r-9', name: 'Ana' })).rejects.toThrow(
        ApartmentOccupiedError,
      );
    });

    test('deactivate frees the apartment for the next occupant', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(maria);
      await repo.deactivate('r-1');
      const ana = await repo.save({ ...maria, id: 'r-9', name: 'Ana' });

      expect(ana.active).toBe(true);
      expect((await repo.getById('r-1'))?.active).toBe(false);
      expect((await repo.list()).map((r) => r.id)).toEqual(['r-9']); // only the active one
    });

    test('listByApartment returns the full history of the apartment', async () => {
      const repo = await makeRepo('condo-a');
      const mamaria = await repo.save(maria);
      await repo.deactivate('r-1');
      await repo.save({ ...maria, id: 'r-9', name: 'Ana' });

      const history = (await repo.listByApartment(mamaria.apartmentId)).map((r) => r.name).sort();
      expect(history).toEqual(['Ana', 'Maria Ribeiro']);
    });

    test('update keeps the id and occupancy, changing person fields', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(maria);
      const updated = await repo.save({ ...maria, name: 'Maria R.', status: 'pendente' });

      expect(updated).toMatchObject({
        id: 'r-1',
        name: 'Maria R.',
        status: 'pendente',
        active: true,
      });
      expect(await repo.list()).toHaveLength(1);
    });

    test('apartmentOf resolves the resident apartment', async () => {
      const repo = await makeRepo('condo-a');
      const saved = await repo.save(maria);
      expect(await repo.apartmentOf('r-1')).toEqual({
        apartmentId: saved.apartmentId,
        apt: 'Apto 302',
      });
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo('condo-a');
      expect(await repo.getById('nope')).toBeNull();
    });

    test('setStatusOverride round-trips and clears', async () => {
      const repo = await makeRepo('condo-a');
      await repo.save(maria);

      await repo.setStatusOverride('r-1', 'atrasado');
      expect((await repo.getById('r-1'))?.statusOverride).toBe('atrasado');

      await repo.setStatusOverride('r-1', null);
      expect((await repo.getById('r-1'))?.statusOverride).toBeNull();
    });

    test("isolation: condo B never sees or changes condo A's data", async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const saved = await repoA.save(maria);

      expect(await repoB.list()).toEqual([]);
      expect(await repoB.getById('r-1')).toBeNull();
      expect(await repoB.listByApartment(saved.apartmentId)).toEqual([]);
      expect(await repoB.apartmentOf('r-1')).toBeNull();
      await expect(repoB.save({ ...maria, name: 'Invasor' })).rejects.toThrow(
        ResidentNotFoundError,
      );
      await repoB.deactivate('r-1');
      await repoB.setStatusOverride('r-1', 'atrasado');

      expect(await repoA.getById('r-1')).toEqual(saved);
    });

    test('the same apartment label is a separate apartment in each condo', async () => {
      const repoA = await makeRepo('condo-a');
      const repoB = await makeRepo('condo-b');
      const inA = await repoA.save(maria);
      const inB = await repoB.save({ ...maria, id: 'r-b' });

      expect(inB.apartmentId).not.toBe(inA.apartmentId);
      expect((await repoB.list()).map((r) => r.id)).toEqual(['r-b']);
    });
  });
}
