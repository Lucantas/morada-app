import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmDialog } from './confirm-dialog';

function props(overrides = {}) {
  return {
    open: true,
    title: 'Registrar saída de Maria?',
    confirmLabel: 'Confirmar saída',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  test('renders nothing when closed', () => {
    render(<ConfirmDialog {...props({ open: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('shows the title and confirm/cancel actions when open', () => {
    render(<ConfirmDialog {...props()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Registrar saída de Maria?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar saída' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  test('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole('button', { name: 'Confirmar saída' }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel on cancel button and on Escape', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.keyboard('{Escape}');
    expect(p.onCancel).toHaveBeenCalledTimes(2);
  });

  test('calls onCancel when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const p = props();
    render(<ConfirmDialog {...p} />);
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await user.click(backdrop);
    expect(p.onCancel).toHaveBeenCalled();
  });
});
