import { screen, waitFor } from '@testing-library/react';
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

    await userEvent.type(screen.getByLabelText('Número do apartamento'), 'Apto 101');
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
    expect(screen.getByDisplayValue('Apto 202')).toBeInTheDocument();
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
});
