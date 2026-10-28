import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useCondoScope } from '@/shared/lib/condo-scope';
import { testCondo } from '@/test/condo';

import { StreetShortcut } from './street-shortcut';

describe('StreetShortcut', () => {
  afterEach(() => {
    act(() => {
      useCondoScope.getState().setCondo(null);
      useCondoScope.getState().setCondoCount(1);
    });
  });

  test('the shortcut is hidden for a resident with a single condo', () => {
    act(() => useCondoScope.getState().setCondo(testCondo({ condoRole: 'morador' })));

    render(<StreetShortcut onClick={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Seus condomínios' })).not.toBeInTheDocument();
  });

  test('is shown for staff and calls onClick', async () => {
    const onClick = jest.fn();
    act(() => useCondoScope.getState().setCondo(testCondo()));
    render(<StreetShortcut onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Seus condomínios' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('is shown for a resident with several condos', () => {
    act(() => {
      useCondoScope.getState().setCondo(testCondo({ condoRole: 'morador' }));
      useCondoScope.getState().setCondoCount(2);
    });

    render(<StreetShortcut onClick={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Seus condomínios' })).toBeInTheDocument();
  });
});
