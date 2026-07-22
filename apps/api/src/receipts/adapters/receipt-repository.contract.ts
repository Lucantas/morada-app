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

      expect(await repo.getById('r-1')).toEqual({ ...receipt, hasProof: false });
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
      expect(stored).toEqual({ ...receipt, hasProof: false });
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

    test('round-trips an em_analise receipt with proof and submittedAt, exposing hasProof (not the raw proof)', async () => {
      const repo = await makeRepo();
      const receipt = {
        id: 'rc-analise',
        ref: '07/2026',
        title: 'Taxa condominial',
        dueDate: '2026-07-15',
        valueCents: 15000,
        status: 'em_analise' as const,
        method: 'pix' as const,
        submittedAt: '2026-07-14',
        proofDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        residentId: 'r-1',
        apartmentId: 'apt-1',
      };
      await repo.save(receipt);
      const { proofDataUrl, ...withoutProof } = receipt;
      void proofDataUrl;
      expect(await repo.getById('rc-analise')).toEqual({ ...withoutProof, hasProof: true });
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

    test('archive hides a receipt from every read', async () => {
      const repo = await makeRepo();
      const base = { ref: '2024-01', title: 'Taxa', dueDate: '2026-05-10', valueCents: 1000 };
      await repo.save({ ...base, id: 'a', status: 'pendente', apartmentId: 'apt-1' });
      await repo.save({ ...base, id: 'b', status: 'pendente', apartmentId: 'apt-1' });

      await repo.archive('a');

      expect(await repo.getById('a')).toBeNull();
      expect((await repo.list()).map((r) => r.id)).not.toContain('a');
      expect((await repo.listByApartment('apt-1')).map((r) => r.id)).toEqual(['b']);
    });
  });
}
