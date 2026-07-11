import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BottomNav, type NavItem } from './bottom-nav';

describe('BottomNav', () => {
  test('renders each item and fires its onClick', async () => {
    const onClick = jest.fn();
    const items: NavItem[] = [
      { key: 'home', label: 'Início', icon: 'home', active: true, onClick: () => {} },
      { key: 'out', label: 'Sair', icon: 'logout', onClick },
    ];
    render(<BottomNav items={items} />);

    expect(screen.getByText('Início')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Sair'));

    expect(onClick).toHaveBeenCalled();
  });
});
