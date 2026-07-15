import { ensureMonthlyReceipts, monthlyRef, monthlyDueDate } from './monthly-receipts';

const settings = { monthlyFeeCents: 15000, dueDay: 15 };
const TODAY = '2026-07-14';

describe('monthly receipt helpers', () => {
  it('formats the ref as MM/YYYY of today', () => {
    expect(monthlyRef(TODAY)).toBe('07/2026');
  });

  it('builds the due date in the current month with a padded day', () => {
    expect(monthlyDueDate(TODAY, 5)).toBe('2026-07-05');
    expect(monthlyDueDate(TODAY, 15)).toBe('2026-07-15');
  });
});

describe('ensureMonthlyReceipts', () => {
  const residents = [
    { id: 'r-1', apartmentId: 'apt-1' },
    { id: 'r-2', apartmentId: 'apt-2' },
  ];

  it("creates a draft for every active resident lacking this month's condo fee", () => {
    const drafts = ensureMonthlyReceipts({ residents, receipts: [], settings, today: TODAY });
    expect(drafts).toEqual([
      {
        residentId: 'r-1',
        apartmentId: 'apt-1',
        ref: '07/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-07-15',
        status: 'pendente',
      },
      {
        residentId: 'r-2',
        apartmentId: 'apt-2',
        ref: '07/2026',
        title: 'Taxa condominial',
        valueCents: 15000,
        dueDate: '2026-07-15',
        status: 'pendente',
      },
    ]);
  });

  it("skips residents who already have this month's condo fee (idempotent)", () => {
    const receipts = [{ residentId: 'r-1', ref: '07/2026', title: 'Taxa condominial' }];
    const drafts = ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY });
    expect(drafts.map((d: { residentId: string }) => d.residentId)).toEqual(['r-2']);
  });

  it('does not treat a different month or a different title as covering this month', () => {
    const receipts = [
      { residentId: 'r-1', ref: '06/2026', title: 'Taxa condominial' },
      { residentId: 'r-2', ref: '07/2026', title: 'Água' },
    ];
    const drafts = ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY });
    expect(drafts.map((d) => d.residentId)).toEqual(['r-1', 'r-2']);
  });

  it('returns nothing when every active resident already has it', () => {
    const receipts = [
      { residentId: 'r-1', ref: '07/2026', title: 'Taxa condominial' },
      { residentId: 'r-2', ref: '07/2026', title: 'Taxa condominial' },
    ];
    expect(ensureMonthlyReceipts({ residents, receipts, settings, today: TODAY })).toEqual([]);
  });
});
