import type { Building, BuildingApartment } from '../domain/building';
import type { BuildingRepository, NewApartment } from '../domain/building-repository';
import { BuildingError } from '../domain/errors';

type Entry = NewApartment & { id: string };

export class InMemoryBuildingRepository implements BuildingRepository {
  private entries: readonly Entry[] = [];
  private nextId = 1;

  async get(): Promise<Building> {
    const toApartment = (entry: Entry): BuildingApartment => ({
      id: entry.id,
      label: entry.label,
      state: 'vazio',
      residentId: null,
      residentName: null,
    });
    const placed = this.entries.filter((entry) => entry.floor !== null);
    const blockNames = [...new Set(placed.map((entry) => entry.block))];
    return {
      blocks: blockNames.map((name) => {
        const inBlock = placed.filter((entry) => entry.block === name);
        const floors = [...new Set(inBlock.map((entry) => entry.floor ?? 0))].sort((a, b) => b - a);
        return {
          name,
          floors: floors.map((floor) => ({
            floor,
            apartments: inBlock.filter((entry) => entry.floor === floor).map(toApartment),
          })),
        };
      }),
      unplaced: this.entries.filter((entry) => entry.floor === null).map(toApartment),
    };
  }

  async addApartment(input: NewApartment): Promise<void> {
    if (this.entries.some((entry) => entry.label === input.label)) {
      throw new BuildingError('conflict', 'Já existe um apartamento com esse nome');
    }
    this.entries = [...this.entries, { ...input, id: `apt-${this.nextId++}` }];
  }

  async renameApartment(id: string, label: string): Promise<void> {
    this.requireEntry(id);
    this.entries = this.entries.map((entry) => (entry.id === id ? { ...entry, label } : entry));
  }

  async deactivateApartment(id: string): Promise<void> {
    this.requireEntry(id);
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  private requireEntry(id: string): void {
    if (!this.entries.some((entry) => entry.id === id)) {
      throw new BuildingError('not_found', 'Apartamento não encontrado');
    }
  }
}
