import { render, screen } from '@testing-library/react';

import { StatusPill, type PillTone } from './status-pill';

describe('StatusPill', () => {
  test.each<PillTone>(['pago', 'pendente', 'atrasado', 'info'])(
    'renders the %s tone label',
    (tone) => {
      render(<StatusPill tone={tone} label={tone} />);
      expect(screen.getByText(tone)).toBeInTheDocument();
    },
  );

  test('renders the small size variant', () => {
    render(<StatusPill tone="pago" label="Pago" size="sm" />);
    expect(screen.getByText('Pago')).toBeInTheDocument();
  });
});
