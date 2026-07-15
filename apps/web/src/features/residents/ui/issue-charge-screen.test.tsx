import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { IssueChargeScreen } from './issue-charge-screen';

describe('IssueChargeScreen', () => {
  it('submits the typed amount as integer cents', async () => {
    const issue = jest.fn().mockResolvedValue(undefined);
    render(
      <IssueChargeScreen residentId="r-1" residentName="Fulana" issue={issue} onBack={() => {}} />,
    );

    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '05/2026' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '45000' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith({
      residentId: 'r-1',
      ref: '05/2026',
      title: 'Taxa condominial',
      valueCents: 45000,
      dueDate: '2026-05-15',
    });
  });

  it('blocks submit when the amount is zero', () => {
    const issue = jest.fn();
    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '05/2026' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(issue).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha referência, valor e vencimento.');
  });

  it('shows an error when adding fails', async () => {
    const issue = jest.fn().mockRejectedValue(new Error('Falhou'));
    render(<IssueChargeScreen residentId="r-1" issue={issue} onBack={() => {}} />);

    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: '05/2026' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '45000' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-05-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Falhou')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
  });
});
