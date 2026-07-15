import type { Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';
import { generateMonthlyReceipts } from './generate-monthly-receipts';

function fakeReceipts(seed: Receipt[] = []): ReceiptRepository & { all: () => Receipt[] } {
  let rows = [...seed];
  return {
    list: async () => rows,
    listByResident: async (rid) => rows.filter((r) => r.residentId === rid),
    listByApartment: async (aid) => rows.filter((r) => r.apartmentId === aid),
    getById: async (id) => rows.find((r) => r.id === id) ?? null,
    save: async (r) => {
      rows = [...rows.filter((x) => x.id !== r.id), r];
      return r;
    },
    all: () => rows,
  };
}

const residents = {
  list: async () => [
    {
      id: 'r-1',
      apartmentId: 'apt-1',
      name: 'A',
      apt: 'Apto 1',
      phone: '',
      email: '',
      status: 'em_dia' as const,
      active: true,
    },
    {
      id: 'r-2',
      apartmentId: 'apt-2',
      name: 'B',
      apt: 'Apto 2',
      phone: '',
      email: '',
      status: 'em_dia' as const,
      active: true,
    },
  ],
} as unknown as Parameters<typeof generateMonthlyReceipts>[1];

const settings = { get: async () => ({ monthlyFeeCents: 15000, dueDay: 15 }) } as Parameters<
  typeof generateMonthlyReceipts
>[2];

const TODAY = '2026-07-14';

describe('generateMonthlyReceipts', () => {
  it('creates one pending condo-fee receipt per active resident, then is idempotent', async () => {
    const receipts = fakeReceipts();

    const first = await generateMonthlyReceipts(receipts, residents, settings, TODAY);
    expect(first).toHaveLength(2);
    expect(receipts.all()).toHaveLength(2);
    expect(
      first.every((r) => r.status === 'pendente' && r.ref === '07/2026' && r.valueCents === 15000),
    ).toBe(true);
    expect(first.map((r) => r.residentId).sort()).toEqual(['r-1', 'r-2']);

    const second = await generateMonthlyReceipts(receipts, residents, settings, TODAY);
    expect(second).toHaveLength(0);
    expect(receipts.all()).toHaveLength(2);
  });
});
