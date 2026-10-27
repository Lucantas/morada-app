import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useCondoScope } from '@/shared/lib/condo-scope';
import { testCondo } from '@/test/condo';

import { useSessionStore } from './session-store';
import { ViewSwitch } from './view-switch';

afterEach(() => {
  act(() => useSessionStore.getState().signOut());
});

describe('ViewSwitch', () => {
  test('renders both labels when the person has a home', () => {
    act(() => useCondoScope.getState().setCondo(testCondo({ hasHome: true })));
    act(() => useSessionStore.getState().authenticate('admin', null));

    render(<ViewSwitch onSwitch={() => {}} />);

    expect(screen.getByRole('button', { name: 'Minha casa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'O prédio' })).toBeInTheDocument();
  });

  test('switches to the resident view from the admin view', async () => {
    const onSwitch = jest.fn();
    act(() => useCondoScope.getState().setCondo(testCondo({ hasHome: true })));
    act(() => useSessionStore.getState().authenticate('admin', null));
    render(<ViewSwitch onSwitch={onSwitch} />);

    await userEvent.click(screen.getByRole('button', { name: 'Minha casa' }));

    expect(onSwitch).toHaveBeenCalledWith('resident');
  });

  test('renders nothing without a home', () => {
    act(() => useCondoScope.getState().setCondo(testCondo({ hasHome: false })));
    act(() => useSessionStore.getState().authenticate('admin', null));

    const { container } = render(<ViewSwitch onSwitch={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
