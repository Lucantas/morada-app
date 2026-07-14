import type { Receipt } from '../../receipts/domain/receipt';
import type { ReceiptRepository } from '../../receipts/domain/receipt-repository';
import type { Resident } from '../domain/resident';
import type { ResidentRepository } from '../domain/resident-repository';

import { listResidents } from './list-residents';

function fakeRepo(list: Resident[]): ResidentRepository {
  const map = new Map(list.map((r) => [r.id, r]));
  return {
    list: async () => [...map.values()].filter((r) => r.active),
    getById: async (id) => map.get(id) ?? null,
    listByApartment: async (aid) => [...map.values()].filter((r) => r.apartmentId === aid),
    apartmentOf: async (id) => {
      const r = map.get(id);
      return r ? { apartmentId: r.apartmentId, apt: r.apt } : null;
    },
    save: async (input) => {
      const resident: Resident = { ...input, apartmentId: `ap-${input.apt}`, active: true };
      map.set(input.id, resident);
      return resident;
    },
    deactivate: async (id) => {
      const r = map.get(id);
      if (r) map.set(id, { ...r, active: false });
    },
  };
}

function fakeReceipts(rows: Pick<Receipt, 'residentId' | 'status'>[]): ReceiptRepository {
  const all = rows as Receipt[];
  return {
    list: async () => all,
    listByResident: async (id) => all.filter((r) => r.residentId === id),
    listByApartment: async () => [],
    getById: async () => null,
    save: async (r) => r,
  };
}

const build = (over: Partial<Resident>): Resident => ({
  id: 'x',
  name: 'Nome',
  apt: 'Apto 1',
  apartmentId: 'ap-1',
  phone: '',
  email: '',
  status: 'em_dia',
  active: true,
  ...over,
});

describe('listResidents', () => {
  test('returns residents sorted by name', async () => {
    const repo = fakeRepo([
      build({ id: 'b', name: 'Bruno' }),
      build({ id: 'a', name: 'Ana' }),
      build({ id: 'c', name: 'Carla' }),
    ]);
    const residents = await listResidents(repo, fakeReceipts([]));
    expect(residents.map((r) => r.name)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  test('derives pendente for a resident with a pending receipt, em_dia otherwise', async () => {
    const repo = fakeRepo([build({ id: 'a', name: 'Ana' }), build({ id: 'b', name: 'Bruno' })]);
    const receipts = fakeReceipts([
      { residentId: 'a', status: 'pendente' },
      { residentId: 'b', status: 'pago' },
    ]);
    const byId = new Map((await listResidents(repo, receipts)).map((r) => [r.id, r.status]));
    expect(byId.get('a')).toBe('pendente');
    expect(byId.get('b')).toBe('em_dia');
  });
});
