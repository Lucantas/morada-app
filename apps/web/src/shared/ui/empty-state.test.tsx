import { render, screen } from '@testing-library/react';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  test('renders the title', () => {
    render(<EmptyState title="Nenhum recibo ainda" />);
    expect(screen.getByText('Nenhum recibo ainda')).toBeInTheDocument();
  });

  test('renders an optional description and action', () => {
    render(
      <EmptyState
        icon="receipt"
        title="Nenhum recibo ainda"
        description="Os recibos aparecem aqui."
        action={<button type="button">Adicionar</button>}
      />,
    );
    expect(screen.getByText('Os recibos aparecem aqui.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
  });
});
