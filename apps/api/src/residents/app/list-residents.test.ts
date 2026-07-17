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
    setStatusOverride: async (id, status) => {
      const r = map.get(id);
      if (r) map.set(id, { ...r, statusOverride: status });
    },
  };
}

function fakeReceipts(
  rows: (Pick<Receipt, 'residentId' | 'status'> & Partial<Pick<Receipt, 'dueDate'>>)[],
): ReceiptRepository {
  const all = rows as Receipt[];
  return {
    list: async () => all,
    listByResident: async (id) => all.filter((r) => r.residentId === id),
    listByApartment: async () => [],
    getById: async () => null,
    save: async (r) => r,
    archive: async () => {},
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
  test('returns residents ordered by apartment number (numeric, not lexical)', async () => {
    const repo = fakeRepo([
      build({ id: 'b', name: 'Bruno', apt: 'Apto 10' }),
      build({ id: 'a', name: 'Ana', apt: 'Apto 2' }),
      build({ id: 'c', name: 'Carla', apt: 'Apto 100' }),
    ]);
    const residents = await listResidents(repo, fakeReceipts([]));
    expect(residents.map((r) => r.apt)).toEqual(['Apto 2', 'Apto 10', 'Apto 100']);
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

  test('an admin status override wins over the derived status', async () => {
    const repo = fakeRepo([build({ id: 'a', name: 'Ana', statusOverride: 'em_dia' })]);
    const receipts = fakeReceipts([{ residentId: 'a', status: 'pendente', dueDate: '2000-01-01' }]);
    const byId = new Map((await listResidents(repo, receipts)).map((r) => [r.id, r.status]));
    expect(byId.get('a')).toBe('em_dia');
  });

  test('a null override falls back to the derived status', async () => {
    const repo = fakeRepo([build({ id: 'a', name: 'Ana', statusOverride: null })]);
    const receipts = fakeReceipts([{ residentId: 'a', status: 'pendente', dueDate: '2000-01-01' }]);
    const byId = new Map((await listResidents(repo, receipts)).map((r) => [r.id, r.status]));
    expect(byId.get('a')).toBe('atrasado');
  });
});
