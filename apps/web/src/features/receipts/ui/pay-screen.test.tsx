import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from '../data/in-memory-receipt-repository';

import { PayScreen } from './pay-screen';

describe('PayScreen', () => {
  test('renders the receipt summary', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', ref: '04/2026', valueCents: 45000, status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    expect(await screen.findByText('REF · 04/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 450,00')).toBeInTheDocument();
  });

  test('selecting a method and confirming pays the receipt and calls onDone', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', status: 'pendente' }),
    ]);
    const onDone = jest.fn();
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={onDone} />);

    await screen.findByText('Taxa condominial');
    await userEvent.click(screen.getByRole('button', { name: 'Boleto' }));
    await userEvent.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const saved = await repository.getById('rc-1');
    expect(saved?.status).toBe('pago');
    expect(saved?.method).toBe('boleto');
  });

  test('copying the Pix code writes the payload to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', ref: '04/2026', valueCents: 45000, status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    await screen.findByText('REF · 04/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Copiar código Pix' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('MORADA042026');
    expect(await screen.findByRole('button', { name: 'Código Pix copiado!' })).toBeInTheDocument();
  });
});
