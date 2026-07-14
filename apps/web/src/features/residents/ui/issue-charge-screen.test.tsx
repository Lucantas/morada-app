import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueChargeScreen } from './issue-charge-screen';

describe('IssueChargeScreen', () => {
  test('adds a receipt with the value converted to cents and an ISO due date', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockResolvedValue(undefined);

    render(
      <IssueChargeScreen
        residentId="r-1"
        residentName="Maria Ribeiro"
        issue={issue}
        onBack={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Referência'), '05/2026');
    await user.type(screen.getByLabelText('Valor (R$)'), '450,00');
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-10' } });
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(issue).toHaveBeenCalledWith({
      residentId: 'r-1',
      ref: '05/2026',
      title: 'Taxa condominial',
      valueCents: 45000,
      dueDate: '2026-05-10',
    });
    expect(await screen.findByText(/recibo adicionado/i)).toBeInTheDocument();
  });

  test('shows an error when adding fails', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockRejectedValue(new Error('Falhou'));

    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={jest.fn()} />);

    await user.type(screen.getByLabelText('Referência'), '05/2026');
    await user.type(screen.getByLabelText('Valor (R$)'), '450');
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-10' } });
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Falhou')).toBeInTheDocument();
  });

  test('blocks submission until reference, value and due date are filled', async () => {
    const user = userEvent.setup();
    const issue = jest.fn();

    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(issue).not.toHaveBeenCalled();
    expect(screen.getByText(/preencha referência, valor e vencimento/i)).toBeInTheDocument();
  });
});
