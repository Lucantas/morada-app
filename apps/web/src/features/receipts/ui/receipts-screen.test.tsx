import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from '../data/in-memory-receipt-repository';

import { ReceiptsScreen } from './receipts-screen';

function setup() {
  const repository = new InMemoryReceiptRepository([
    buildReceipt({ id: 'rc-1', ref: '04/2026', status: 'pendente' }),
    buildReceipt({
      id: 'rc-2',
      ref: '03/2026',
      dueDate: '2026-03-10',
      paidAt: '2026-03-08',
      status: 'pago',
      method: 'pix',
    }),
  ]);
  const onPay = jest.fn();
  renderWithClient(
    <ReceiptsScreen
      repository={repository}
      resident={{ name: 'Maria Ribeiro', apt: 'Apto 302' }}
      onPay={onPay}
      bottomNav={null}
    />,
  );
  return { onPay };
}

describe('ReceiptsScreen', () => {
  test('renders the receipt cards once loaded', async () => {
    setup();

    expect(await screen.findAllByText('Taxa condominial')).toHaveLength(2);
    expect(screen.getByText('REF · 04/2026')).toBeInTheDocument();
    expect(screen.getByText('REF · 03/2026')).toBeInTheDocument();
  });

  test('shows the pending banner for the first pending receipt', async () => {
    setup();

    expect(await screen.findByText('Taxa de 04/2026 pendente')).toBeInTheDocument();
  });

  test('paying calls onPay with the receipt id', async () => {
    const { onPay } = setup();
    await screen.findByText('Taxa de 04/2026 pendente');

    await userEvent.click(screen.getByRole('button', { name: /pagar taxa/i }));

    await waitFor(() => expect(onPay).toHaveBeenCalledWith('rc-1'));
  });

  test('a paid receipt shows the payment method', async () => {
    setup();

    expect(await screen.findByText('Pago via')).toBeInTheDocument();
    expect(screen.getByText('Pix')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /baixar comprovante/i })).toBeInTheDocument();
  });

  test('shows an empty state when the resident has no receipts', async () => {
    const repository = new InMemoryReceiptRepository([]);
    renderWithClient(
      <ReceiptsScreen
        repository={repository}
        resident={{ name: 'Maria', apt: 'Apto 302' }}
        onPay={jest.fn()}
        bottomNav={null}
      />,
    );
    expect(await screen.findByText('Nenhum recibo ainda')).toBeInTheDocument();
  });
});
