import type { ReceiptRepository } from '../domain/receipt-repository';

// Behavioural contract every ReceiptRepository must satisfy, run against both the
// SQLite and Postgres adapters so the two stores stay in lockstep.
export function runReceiptRepositoryContract(
  label: string,
  makeRepo: () => Promise<ReceiptRepository>,
): void {
  describe(label, () => {
    test('save then getById round-trips a receipt with a method', async () => {
      const repo = await makeRepo();
      const receipt = {
        id: 'r-1',
        ref: '2024-01',
        title: 'Boleto',
        dueDate: '2026-05-10',
        valueCents: 1000,
        status: 'pago' as const,
        method: 'pix' as const,
      };

      await repo.save(receipt);

      expect(await repo.getById('r-1')).toEqual(receipt);
    });

    test('save then getById round-trips a receipt without a method (null coerced to undefined)', async () => {
      const repo = await makeRepo();
      const receipt = {
        id: 'r-2',
        ref: '2024-02',
        title: 'Boleto',
        dueDate: '2026-05-10',
        valueCents: 2000,
        status: 'pendente' as const,
      };

      await repo.save(receipt);

      const stored = await repo.getById('r-2');
      expect(stored).toEqual(receipt);
      expect(stored?.method).toBeUndefined();
    });

    test('save upserts on conflicting id', async () => {
      const repo = await makeRepo();
      await repo.save({
        id: 'r-1',
        ref: '2024-01',
        title: 'Boleto',
        dueDate: '2026-05-10',
        valueCents: 1000,
        status: 'pendente',
      });
      await repo.save({
        id: 'r-1',
        ref: '2024-01',
        title: 'Boleto',
        dueDate: '2026-05-10',
        valueCents: 1000,
        status: 'pago',
        method: 'dinheiro',
      });

      expect(await repo.list()).toHaveLength(1);
      expect((await repo.getById('r-1'))?.status).toBe('pago');
      expect((await repo.getById('r-1'))?.method).toBe('dinheiro');
    });

    test('getById returns null when missing', async () => {
      const repo = await makeRepo();
      expect(await repo.getById('nope')).toBeNull();
    });

    test('listByResident returns only that resident receipts and round-trips residentId', async () => {
      const repo = await makeRepo();
      const base = { ref: '2024-01', title: 'Taxa', dueDate: '2026-05-10', valueCents: 1000 };
      await repo.save({ ...base, id: 'a1', status: 'pendente', residentId: 'r-1' });
      await repo.save({ ...base, id: 'a2', status: 'pago', method: 'pix', residentId: 'r-1' });
      await repo.save({ ...base, id: 'b1', status: 'pendente', residentId: 'r-2' });

      const mine = await repo.listByResident('r-1');
      expect(mine.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
      expect(mine.every((r) => r.residentId === 'r-1')).toBe(true);
      expect(await repo.listByResident('r-2')).toHaveLength(1);
      expect(await repo.listByResident('r-9')).toHaveLength(0);
    });
  });
}
