import { render, screen } from '@testing-library/react';

import { GroundCards } from './ground-cards';

describe('GroundCards', () => {
  test('lists the count and the first three category names', () => {
    render(
      <GroundCards
        categories={['Água', 'Energia', 'Limpeza', 'Elevador']}
        monthSpentCents={412_000}
        cashCents={1_248_000}
      />,
    );

    expect(screen.getByText('Contas')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('Água · Energia · Limpeza')).toBeVisible();
  });

  test('shows the month spend and the cash', () => {
    render(<GroundCards categories={[]} monthSpentCents={412_000} cashCents={1_248_000} />);

    expect(screen.getByText('Gasto no mês')).toBeVisible();
    expect(screen.getByText('R$ 4.120,00')).toBeVisible();
    expect(screen.getByText('Em caixa')).toBeVisible();
    expect(screen.getByText('R$ 12.480,00')).toBeVisible();
  });
});
