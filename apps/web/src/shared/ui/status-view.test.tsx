import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StatusView } from './status-view';

describe('StatusView', () => {
  test('renders a loading message with status role', () => {
    render(<StatusView variant="loading" message="Carregando…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
  });

  test('renders an error message with alert role', () => {
    render(<StatusView variant="error" message="Falhou." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou.');
  });

  test('calls onRetry from the retry button in the error variant', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<StatusView variant="error" message="Falhou." onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
