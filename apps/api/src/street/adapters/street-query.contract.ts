import type { StreetQuery } from '../domain/street-query';

export interface StreetSeed {
  apartment(
    condoId: string,
    id: string,
    placement: { block: string | null; floor: number | null; position: number | null },
    active?: boolean,
  ): Promise<void>;
  resident(
    condoId: string,
    id: string,
    opts: { override: string | null; apartmentId: string | null; occupancyActive?: boolean },
  ): Promise<void>;
  receipt(
    condoId: string,
    residentId: string,
    status: string,
    dueDate: string | null,
    visible?: boolean,
  ): Promise<void>;
  account(
    condoId: string,
    status: string,
    dueDate: string | null,
    visible?: boolean,
  ): Promise<void>;
  thread(condoId: string, residentMessageAt: string | null): Promise<string>;
  user(id: string): Promise<void>;
  markRead(threadId: string, userId: string, condoId: string, readAt: string): Promise<void>;
}

const TODAY = '2026-10-28';
const A = 'condo-a';
const B = 'condo-b';

export function runStreetQueryContract(
  label: string,
  makeQuery: () => Promise<StreetQuery>,
  seed: StreetSeed,
): void {
  describe(label, () => {
    test('counts only the requested condos and never mixes A into B', async () => {
      const query = await makeQuery();
      await seed.account(A, 'atrasado', null);
      await seed.account(A, 'atrasado', null);
      await seed.account(B, 'atrasado', null);

      const onlyA = await query.factsFor([A], 'u1', TODAY);
      const both = await query.factsFor([A, B], 'u1', TODAY);

      expect([...onlyA.keys()]).toEqual([A]);
      expect(onlyA.get(A)?.pendencies.overdueAccounts).toBe(2);
      expect(both.get(A)?.pendencies.overdueAccounts).toBe(2);
      expect(both.get(B)?.pendencies.overdueAccounts).toBe(1);
    });

    test('overdue residents follow the resident list: override wins over derived status', async () => {
      const query = await makeQuery();
      await seed.apartment(A, 'a1', { block: null, floor: 1, position: 1 });
      await seed.apartment(A, 'a2', { block: null, floor: 1, position: 2 });
      await seed.apartment(A, 'a3', { block: null, floor: 1, position: 3 });
      await seed.apartment(A, 'a4', { block: null, floor: 1, position: 4 });
      await seed.apartment(B, 'b1', { block: null, floor: 1, position: 1 });
      await seed.resident(A, 'r-emdia', { override: 'em_dia', apartmentId: 'a1' });
      await seed.receipt(A, 'r-emdia', 'pendente', '2026-10-01');
      await seed.resident(A, 'r-atrasado', { override: 'atrasado', apartmentId: 'a2' });
      await seed.resident(A, 'r-derived', { override: null, apartmentId: 'a3' });
      await seed.receipt(A, 'r-derived', 'pendente', '2026-10-27');
      await seed.resident(A, 'r-inactive', {
        override: 'atrasado',
        apartmentId: 'a4',
        occupancyActive: false,
      });
      await seed.resident(B, 'r-b', { override: 'atrasado', apartmentId: 'b1' });

      const facts = await query.factsFor([A, B], 'u1', TODAY);

      expect(facts.get(A)?.pendencies.overdueResidents).toBe(2);
      expect(facts.get(B)?.pendencies.overdueResidents).toBe(1);
    });

    test('an archived overdue receipt does not make the resident overdue', async () => {
      const query = await makeQuery();
      await seed.apartment(A, 'a1', { block: null, floor: 1, position: 1 });
      await seed.resident(A, 'r1', { override: null, apartmentId: 'a1' });
      await seed.receipt(A, 'r1', 'pendente', '2026-10-01', false);

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies.overdueResidents).toBe(0);
    });

    test('an archived receipt under review is not a proof to review', async () => {
      const query = await makeQuery();
      await seed.apartment(A, 'a1', { block: null, floor: 1, position: 1 });
      await seed.resident(A, 'r1', { override: null, apartmentId: 'a1' });
      await seed.receipt(A, 'r1', 'em_analise', '2026-10-01', false);

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies.proofsToReview).toBe(0);
    });

    test('derived status ignores receipts that are paid, not yet due, or due today', async () => {
      const query = await makeQuery();
      await seed.apartment(A, 'a1', { block: null, floor: 1, position: 1 });
      await seed.resident(A, 'r1', { override: null, apartmentId: 'a1' });
      await seed.receipt(A, 'r1', 'pago', '2026-10-01');
      await seed.receipt(A, 'r1', 'pendente', TODAY);
      await seed.receipt(A, 'r1', 'pendente', '2026-11-15');

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies.overdueResidents).toBe(0);
    });

    test('account due dates: due today and today+3 are due soon, today+4 is not, yesterday is overdue', async () => {
      const query = await makeQuery();
      await seed.account(A, 'pendente', '2026-10-28');
      await seed.account(A, 'pendente', '2026-10-31');
      await seed.account(A, 'pendente', '2026-11-01');
      await seed.account(A, 'pendente', '2026-10-27');

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies).toMatchObject({ accountsDueSoon: 2, overdueAccounts: 1 });
    });

    test('an atrasado account with no due date is overdue and never due soon', async () => {
      const query = await makeQuery();
      await seed.account(A, 'atrasado', null);
      await seed.account(A, 'atrasado', '2026-10-30');
      await seed.account(A, 'pendente', null);

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies).toMatchObject({ accountsDueSoon: 0, overdueAccounts: 2 });
    });

    test('paid and hidden accounts never count', async () => {
      const query = await makeQuery();
      await seed.account(A, 'pago', '2026-10-01');
      await seed.account(A, 'pago', '2026-10-29');
      await seed.account(A, 'atrasado', '2026-10-01', false);
      await seed.account(A, 'pendente', '2026-10-29', false);

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies).toMatchObject({ accountsDueSoon: 0, overdueAccounts: 0 });
    });

    test('proofs to review count em_analise receipts', async () => {
      const query = await makeQuery();
      await seed.resident(A, 'r1', { override: null, apartmentId: null });
      await seed.receipt(A, 'r1', 'em_analise', '2026-10-10');
      await seed.receipt(A, 'r1', 'em_analise', '2026-11-10');
      await seed.receipt(A, 'r1', 'pendente', '2026-11-10');
      await seed.receipt(A, 'r1', 'pago', '2026-09-10');

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.pendencies.proofsToReview).toBe(2);
    });

    test('unread threads are counted for the viewer only', async () => {
      const query = await makeQuery();
      await seed.user('u1');
      await seed.user('u2');
      const read = await seed.thread(A, '2026-10-20T10:00:00Z');
      await seed.thread(A, '2026-10-21T10:00:00Z');
      await seed.thread(A, null);
      await seed.thread(B, '2026-10-21T10:00:00Z');
      await seed.markRead(read, 'u1', A, '2026-10-22T10:00:00Z');

      const forU1 = await query.factsFor([A, B], 'u1', TODAY);
      const forU2 = await query.factsFor([A, B], 'u2', TODAY);

      expect(forU1.get(A)?.pendencies.unreadThreads).toBe(1);
      expect(forU2.get(A)?.pendencies.unreadThreads).toBe(2);
      expect(forU1.get(B)?.pendencies.unreadThreads).toBe(1);
    });

    test('windows list placed active apartments lit by active occupancy', async () => {
      const query = await makeQuery();
      await seed.apartment(A, 'a-b2', { block: 'B', floor: 1, position: 1 });
      await seed.apartment(A, 'a-102', { block: null, floor: 1, position: 2 });
      await seed.apartment(A, 'a-101', { block: null, floor: 1, position: 1 });
      await seed.apartment(A, 'a-201', { block: null, floor: 2, position: 1 });
      await seed.apartment(A, 'a-loja', { block: null, floor: null, position: null });
      await seed.apartment(A, 'a-off', { block: null, floor: 3, position: 1 }, false);
      await seed.apartment(B, 'b-1', { block: null, floor: 1, position: 1 });
      await seed.resident(A, 'r1', { override: null, apartmentId: 'a-102' });
      await seed.resident(A, 'r2', {
        override: null,
        apartmentId: 'a-201',
        occupancyActive: false,
      });

      const facts = await query.factsFor([A], 'u1', TODAY);

      expect(facts.get(A)?.windows).toEqual([
        { block: null, floor: 1, position: 1, lit: false },
        { block: null, floor: 1, position: 2, lit: true },
        { block: null, floor: 2, position: 1, lit: false },
        { block: 'B', floor: 1, position: 1, lit: false },
      ]);
    });

    test('ids without data come back with zero pendencies and no windows', async () => {
      const query = await makeQuery();

      const facts = await query.factsFor([A, B], 'u1', TODAY);

      const empty = {
        pendencies: {
          overdueResidents: 0,
          overdueAccounts: 0,
          accountsDueSoon: 0,
          proofsToReview: 0,
          unreadThreads: 0,
        },
        windows: [],
      };
      expect(facts.get(A)).toEqual(empty);
      expect(facts.get(B)).toEqual(empty);
    });
  });
}
