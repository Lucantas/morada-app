import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NewReceiptCard } from './new-receipt-card';

describe('NewReceiptCard', () => {
  test('adds a pending receipt with the derived due date and keeps the card open', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockResolvedValue(undefined);
    render(<NewReceiptCard dueDay={15} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), '04/2026');
    await user.type(screen.getByLabelText('Valor'), '15000');
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    await waitFor(() =>
      expect(issue).toHaveBeenCalledWith({
        ref: '04/2026',
        valueCents: 15000,
        dueDate: '2026-04-15',
      }),
    );
    // card stays open with cleared competência
    expect(screen.getByLabelText('Competência')).toHaveValue('');
  });

  test('blocks saving when the competência is not MM/AAAA', async () => {
    const user = userEvent.setup();
    const issue = jest.fn();
    render(<NewReceiptCard dueDay={15} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), 'abril');
    await user.type(screen.getByLabelText('Valor'), '15000');
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    expect(issue).not.toHaveBeenCalled();
    expect(screen.getByText(/use mm\/aaaa/i)).toBeInTheDocument();
  });

  test('sends paidAt and method when marked paid', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockResolvedValue(undefined);
    render(<NewReceiptCard dueDay={10} issue={issue} onClose={jest.fn()} />);

    await user.type(screen.getByLabelText('Competência'), '05/2026');
    await user.type(screen.getByLabelText('Valor'), '20000');
    await user.click(screen.getByRole('button', { name: 'Pago' }));
    await user.click(screen.getByRole('button', { name: /adicionar e continuar/i }));

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    const arg = issue.mock.calls[0][0];
    expect(arg).toMatchObject({
      ref: '05/2026',
      valueCents: 20000,
      dueDate: '2026-05-10',
      method: 'dinheiro',
    });
    expect(typeof arg.paidAt).toBe('string');
  });

  test('Concluir closes the card', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<NewReceiptCard dueDay={15} issue={jest.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /concluir/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
