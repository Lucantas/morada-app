import { screen } from '@testing-library/react';

import { renderWithClient } from '@/test/render';

import { PayScreen } from './pay-screen';

jest.mock('../domain/get-receipt', () => ({
  getReceipt: () => new Promise(() => {}),
}));

describe('PayScreen loading', () => {
  test('renders the skeleton while the receipt loads', () => {
    renderWithClient(<PayScreen repository={{} as never} receiptId="rc-1" onDone={() => {}} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});
