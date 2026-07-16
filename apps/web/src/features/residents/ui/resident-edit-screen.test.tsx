import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InMemoryReceiptRepository } from '@/features/receipts/data/in-memory-receipt-repository';
import { renderWithClient } from '@/test/render';
import { buildResident } from '@/test/factories';
import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryResidentRepository } from '../data/in-memory-resident-repository';

import { ResidentEditScreen } from './resident-edit-screen';

const noReceipts = () => new InMemoryReceiptRepository([]);

describe('ResidentEditScreen', () => {
  test('registers a new apartment with its resident and navigates back', async () => {
    const repository = new InMemoryResidentRepository([]);
    const onBack = jest.fn();
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        onBack={onBack}
      />,
    );

    await userEvent.type(screen.getByLabelText('Número do apartamento'), '101');
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Carla Dias');
    await userEvent.click(screen.getByRole('button', { name: /cadastrar apartamento/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    const saved = await repository.list();
    expect(saved.map((r) => r.name)).toContain('Carla Dias');
    expect(saved.map((r) => r.apt)).toContain('Apto 101');
  });

  test('prefills the form when editing an existing apartment', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apt: 'Apto 202' }),
    ]);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-7"
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Diego Reis')).toBeInTheDocument();
    // The apartment field is numeric: it shows just the number, not the "Apto" label.
    expect(screen.getByDisplayValue('202')).toBeInTheDocument();
    expect(screen.getByLabelText('Número do apartamento')).toHaveValue('202');
  });

  test('archiving a resident deactivates them and navigates back', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apt: 'Apto 202', active: true }),
    ]);
    const onBack = jest.fn();
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-7"
        onBack={onBack}
      />,
    );

    await screen.findByDisplayValue('Diego Reis');
    await userEvent.click(screen.getByRole('button', { name: /arquivar morador/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirmar saída/i }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect((await repository.getById('r-7'))?.active).toBe(false);
  });

  test('shows the apartment past occupants under "moradores antigos"', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
      buildResident({ id: 'r-old', name: 'Fulana Antiga', apartmentId: 'apt-1', active: false }),
    ]);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-7"
        onBack={jest.fn()}
      />,
    );

    await screen.findByDisplayValue('Diego Reis');
    await userEvent.click(screen.getByRole('button', { name: /ver moradores antigos/i }));

    expect(await screen.findByText('Fulana Antiga')).toBeInTheDocument();
  });

  test("lists the apartment's receipts", async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
    ]);
    const receiptRepository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', title: 'Taxa condominial', apartmentId: 'apt-1' }),
    ]);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={receiptRepository}
        residentId="r-7"
        onBack={jest.fn()}
      />,
    );

    expect(await screen.findByText('Recibos de pagamento')).toBeInTheDocument();
    expect(await screen.findByText('Taxa condominial')).toBeInTheDocument();
  });

  test('lets the admin register a payment (baixa) informing the method and date', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
    ]);
    const receiptRepository = new InMemoryReceiptRepository([
      buildReceipt({
        id: 'rc-1',
        title: 'Taxa condominial',
        apartmentId: 'apt-1',
        status: 'pendente',
      }),
    ]);
    const registerPayment = jest.fn().mockResolvedValue(undefined);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={receiptRepository}
        residentId="r-7"
        onBack={jest.fn()}
        registerPayment={registerPayment}
      />,
    );

    await screen.findByText('Taxa condominial');
    await userEvent.click(screen.getByRole('button', { name: /dar baixa/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Pix' }));
    fireEvent.change(screen.getByLabelText('Data do pagamento'), {
      target: { value: '2026-05-08' },
    });
    await userEvent.click(screen.getByRole('button', { name: /confirmar baixa/i }));

    await waitFor(() =>
      expect(registerPayment).toHaveBeenCalledWith({
        receiptId: 'rc-1',
        method: 'pix',
        paidAt: '2026-05-08',
      }),
    );
  });

  test('lets the admin edit a receipt in the ledger', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
    ]);
    const receiptRepository = new InMemoryReceiptRepository([
      buildReceipt({
        id: 'rc-1',
        ref: '05/2026',
        title: 'Taxa condominial',
        apartmentId: 'apt-1',
        valueCents: 45000,
        dueDate: '2026-05-15',
        status: 'pendente',
      }),
    ]);
    const onEditReceipt = jest.fn().mockResolvedValue(undefined);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={receiptRepository}
        residentId="r-7"
        onBack={jest.fn()}
        onEditReceipt={onEditReceipt}
      />,
    );

    await screen.findByText('Taxa condominial');
    await userEvent.click(screen.getByRole('button', { name: /editar/i }));

    const refField = screen.getByLabelText('Referência');
    fireEvent.change(refField, { target: { value: '06/2026' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-06-15' } });
    await userEvent.click(screen.getByRole('button', { name: /salvar edição/i }));

    await waitFor(() =>
      expect(onEditReceipt).toHaveBeenCalledWith({
        receiptId: 'rc-1',
        ref: '06/2026',
        title: 'Taxa condominial',
        valueCents: 50000,
        dueDate: '2026-06-15',
      }),
    );
  });

  test('lets the admin confirm or reject a payment submitted for review', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
    ]);
    const receiptRepository = new InMemoryReceiptRepository([
      buildReceipt({
        id: 'rc-1',
        title: 'Taxa condominial',
        apartmentId: 'apt-1',
        status: 'em_analise',
        proofDataUrl: 'data:image/png;base64,abc123',
      }),
    ]);
    const onConfirmPayment = jest.fn().mockResolvedValue(undefined);
    const onRejectPayment = jest.fn().mockResolvedValue(undefined);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={receiptRepository}
        residentId="r-7"
        onBack={jest.fn()}
        onConfirmPayment={onConfirmPayment}
        onRejectPayment={onRejectPayment}
      />,
    );

    await screen.findByText('Taxa condominial');

    expect(screen.queryByRole('button', { name: /dar baixa/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver comprovante/i })).toHaveAttribute(
      'href',
      'data:image/png;base64,abc123',
    );

    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(onConfirmPayment).toHaveBeenCalledWith('rc-1'));
    expect(onRejectPayment).not.toHaveBeenCalled();
  });

  test('lets the admin override or clear the resident status', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-7', name: 'Diego Reis', apartmentId: 'apt-1', active: true }),
    ]);
    const onOverrideStatus = jest.fn().mockResolvedValue(undefined);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-7"
        onBack={jest.fn()}
        onOverrideStatus={onOverrideStatus}
      />,
    );

    await screen.findByDisplayValue('Diego Reis');

    expect(screen.getByRole('button', { name: 'Automático' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Em dia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pendente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrasado' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Atrasado' }));
    await waitFor(() =>
      expect(onOverrideStatus).toHaveBeenCalledWith({ residentId: 'r-7', status: 'atrasado' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Automático' }));
    await waitFor(() =>
      expect(onOverrideStatus).toHaveBeenCalledWith({ residentId: 'r-7', status: null }),
    );
  });

  test('shows a manual hint next to the status pill when the status is overridden', async () => {
    const repository = new InMemoryResidentRepository([
      buildResident({
        id: 'r-7',
        name: 'Diego Reis',
        apartmentId: 'apt-1',
        active: true,
        status: 'atrasado',
        statusOverride: 'atrasado',
      }),
    ]);
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-7"
        onBack={jest.fn()}
        onOverrideStatus={jest.fn()}
      />,
    );

    await screen.findByDisplayValue('Diego Reis');
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
  });

  test('archiving a resident asks for confirmation before deactivating', async () => {
    const user = userEvent.setup();
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302', active: true }),
    ]);
    const deactivateSpy = jest.spyOn(repository, 'deactivate');
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-1"
        onBack={jest.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /arquivar morador/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(deactivateSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirmar saída/i }));

    await waitFor(() => expect(deactivateSpy).toHaveBeenCalledWith('r-1'));
  });

  test('cancelling the archive confirmation does not deactivate', async () => {
    const user = userEvent.setup();
    const repository = new InMemoryResidentRepository([
      buildResident({ id: 'r-1', name: 'Maria Ribeiro', apt: 'Apto 302', active: true }),
    ]);
    const deactivateSpy = jest.spyOn(repository, 'deactivate');
    renderWithClient(
      <ResidentEditScreen
        repository={repository}
        receiptRepository={noReceipts()}
        residentId="r-1"
        onBack={jest.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /arquivar morador/i }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deactivateSpy).not.toHaveBeenCalled();
  });
});
