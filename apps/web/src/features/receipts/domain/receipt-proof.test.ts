import { buildReceiptProof, proofFileName } from './receipt-proof';
import type { Receipt } from './receipt';

const paid: Receipt = {
  id: 'rc-2',
  ref: '03/2026',
  title: 'Taxa condominial',
  dueDate: '2026-03-10',
  paidAt: '2026-03-08',
  valueCents: 45000,
  status: 'pago',
  method: 'pix',
};

describe('buildReceiptProof', () => {
  test('renders a self-contained HTML document', () => {
    const proof = buildReceiptProof(paid, { name: 'Maria Ribeiro', apt: 'Apto 302' });
    expect(proof.startsWith('<!doctype html>')).toBe(true);
    expect(proof).toContain('<html lang="pt-BR">');
    expect(proof).toContain('Condomínio · Bloco 2');
    expect(proof).toContain('Comprovante de pagamento');
  });

  test('shows the paid amount as the headline value', () => {
    const proof = buildReceiptProof(paid, { name: 'Maria Ribeiro', apt: 'Apto 302' });
    expect(proof).toContain('Valor pago');
    expect(proof).toContain('R$ 450,00');
  });

  test('includes the resident data with the apartment number', () => {
    const proof = buildReceiptProof(paid, { name: 'Maria Ribeiro', apt: 'Apto 302' });
    expect(proof).toContain('Maria Ribeiro');
    expect(proof).toContain('>302<');
  });

  test('includes the payment details with formatted dates and method', () => {
    const proof = buildReceiptProof(paid, { name: 'Maria Ribeiro', apt: 'Apto 302' });
    expect(proof).toContain('03/2026');
    expect(proof).toContain('Taxa condominial');
    expect(proof).toContain('Pix');
    expect(proof).toContain('10/03/2026');
    expect(proof).toContain('08/03/2026');
  });

  test('omits the payment method row when there is none', () => {
    const proof = buildReceiptProof({ ...paid, method: undefined }, { name: 'X', apt: 'Y' });
    expect(proof).not.toContain('Forma de pagamento');
  });

  test('omits the due date row when there is none', () => {
    const proof = buildReceiptProof({ ...paid, dueDate: null }, { name: 'X', apt: 'Y' });
    expect(proof).not.toContain('Vencimento');
  });

  test('escapes HTML in dynamic values to prevent injection', () => {
    const proof = buildReceiptProof(
      { ...paid, title: '<script>alert(1)</script>' },
      { name: 'Maria <b>R</b>', apt: 'Apto 302' },
    );
    expect(proof).not.toContain('<script>alert(1)</script>');
    expect(proof).toContain('&lt;script&gt;');
    expect(proof).toContain('Maria &lt;b&gt;R&lt;/b&gt;');
  });
});

describe('proofFileName', () => {
  test('builds an html filename from the ref', () => {
    expect(proofFileName({ ref: '03/2026' })).toBe('comprovante-morada-032026.html');
  });
});
