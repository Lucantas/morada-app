import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InMemoryReceiptRepository } from '@/features/receipts/data/in-memory-receipt-repository';
import { buildReceipt } from '@/test/factories.receipts';
import { buildCurrentResident } from '@/test/factories.resident-home';
import { renderWithClient } from '@/test/render';

import { ResidentHomeScreen } from './resident-home-screen';

function setup() {
  const receiptRepository = new InMemoryReceiptRepository([
    buildReceipt({
      id: 'rc-1',
      ref: '04/2026',
      dueDate: '2026-04-10',
      valueCents: 45000,
      status: 'pendente',
    }),
  ]);
  const onGoReceipts = jest.fn();
  const onGoFinance = jest.fn();
  const onGoNotices = jest.fn();
  renderWithClient(
    <ResidentHomeScreen
      receiptRepository={receiptRepository}
      resident={buildCurrentResident()}
      onGoReceipts={onGoReceipts}
      onGoFinance={onGoFinance}
      onGoNotices={onGoNotices}
      bottomNav={null}
    />,
  );
  return { onGoReceipts, onGoFinance, onGoNotices };
}

describe('ResidentHomeScreen', () => {
  test('renders the greeting with the resident first name', async () => {
    setup();

    expect(await screen.findByText('Olá, Maria')).toBeInTheDocument();
  });

  test('renders the pending fee value and a shortcut', async () => {
    setup();

    expect(await screen.findByText('450,00')).toBeInTheDocument();
    expect(screen.getByText('Recibos')).toBeInTheDocument();
  });

  test('clicking "Pagar taxa" fires onGoReceipts', async () => {
    const { onGoReceipts } = setup();

    await userEvent.click(await screen.findByRole('button', { name: /pagar taxa/i }));

    expect(onGoReceipts).toHaveBeenCalledTimes(1);
  });

  test('clicking the "Condomínio" shortcut fires onGoFinance', async () => {
    const { onGoFinance } = setup();

    await userEvent.click(await screen.findByText('Condomínio'));

    expect(onGoFinance).toHaveBeenCalledTimes(1);
  });
});
