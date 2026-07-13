import { buildReceiptProof, proofFileName } from './receipt-proof';
import type { Receipt } from './receipt';

const paid: Receipt = {
  id: 'rc-2',
  ref: '03/2026',
  title: 'Taxa condominial',
  dueLabel: 'Pago em 08/03/2026',
  valueCents: 45000,
  status: 'pago',
  method: 'pix',
};

describe('buildReceiptProof', () => {
  test('includes the resident, reference, value and status', () => {
    const proof = buildReceiptProof(paid, { name: 'Maria Ribeiro', apt: 'Apto 302' });
    expect(proof).toContain('Maria Ribeiro · Apto 302');
    expect(proof).toContain('Referência: 03/2026');
    expect(proof).toContain('R$');
    expect(proof).toContain('Pago');
  });

  test('omits the payment method line when there is none', () => {
    const proof = buildReceiptProof({ ...paid, method: undefined }, { name: 'X', apt: 'Y' });
    expect(proof).not.toContain('Forma de pagamento');
  });
});

describe('proofFileName', () => {
  test('builds a txt filename from the ref', () => {
    expect(proofFileName({ ref: '03/2026' })).toBe('comprovante-morada-032026.txt');
  });
});
