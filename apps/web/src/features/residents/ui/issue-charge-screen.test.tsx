import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueChargeScreen } from './issue-charge-screen';

describe('IssueChargeScreen', () => {
  test('issues a charge with the value converted to cents', async () => {
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
    await user.type(screen.getByLabelText('Vencimento'), 'Venc. 10/05/2026');
    await user.click(screen.getByRole('button', { name: 'Emitir cobrança' }));

    expect(issue).toHaveBeenCalledWith({
      residentId: 'r-1',
      ref: '05/2026',
      title: 'Taxa condominial',
      valueCents: 45000,
      dueLabel: 'Venc. 10/05/2026',
    });
    expect(await screen.findByText(/cobrança emitida/i)).toBeInTheDocument();
  });

  test('shows an error when issuing fails', async () => {
    const user = userEvent.setup();
    const issue = jest.fn().mockRejectedValue(new Error('Falhou'));

    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={jest.fn()} />);

    await user.type(screen.getByLabelText('Referência'), '05/2026');
    await user.type(screen.getByLabelText('Valor (R$)'), '450');
    await user.type(screen.getByLabelText('Vencimento'), 'x');
    await user.click(screen.getByRole('button', { name: 'Emitir cobrança' }));

    expect(await screen.findByText('Falhou')).toBeInTheDocument();
  });
});
