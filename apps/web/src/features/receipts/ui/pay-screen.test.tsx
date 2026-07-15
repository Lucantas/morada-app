import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithClient } from '@/test/render';
import { buildReceipt } from '@/test/factories.receipts';

import { InMemoryReceiptRepository } from '../data/in-memory-receipt-repository';

import { PayScreen } from './pay-screen';

function uploadProof(input: HTMLElement, file: File) {
  fireEvent.change(input, { target: { files: [file] } });
}

describe('PayScreen', () => {
  test('renders the receipt summary', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', ref: '04/2026', valueCents: 45000, status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    expect(await screen.findByText('REF · 04/2026')).toBeInTheDocument();
    expect(screen.getByText('R$ 450,00')).toBeInTheDocument();
  });

  test('selecting a method, uploading a proof and confirming submits the receipt for review and calls onDone', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', status: 'pendente' }),
    ]);
    const onDone = jest.fn();
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={onDone} />);

    await screen.findByText('Taxa condominial');
    await userEvent.click(screen.getByRole('button', { name: 'Dinheiro' }));
    const file = new File(['fake-image-bytes'], 'comprovante.png', { type: 'image/png' });
    uploadProof(screen.getByLabelText(/comprovante/i), file);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviar comprovante/i })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: /enviar comprovante/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const saved = await repository.getById('rc-1');
    expect(saved?.status).toBe('em_analise');
    expect(saved?.method).toBe('dinheiro');
    expect(saved?.proofDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  test('the confirm button stays disabled until a valid proof is uploaded', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    await screen.findByText('Taxa condominial');

    expect(screen.getByRole('button', { name: /enviar comprovante/i })).toBeDisabled();
  });

  test('uploading a disallowed file type shows an inline error and keeps the button disabled', async () => {
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    await screen.findByText('Taxa condominial');
    const file = new File(['plain text'], 'nota.txt', { type: 'text/plain' });
    uploadProof(screen.getByLabelText(/comprovante/i), file);

    expect(await screen.findByText(/envie uma imagem ou pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar comprovante/i })).toBeDisabled();
  });

  test('copying the Pix code writes the payload to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const repository = new InMemoryReceiptRepository([
      buildReceipt({ id: 'rc-1', ref: '04/2026', valueCents: 45000, status: 'pendente' }),
    ]);
    renderWithClient(<PayScreen repository={repository} receiptId="rc-1" onDone={jest.fn()} />);

    await screen.findByText('REF · 04/2026');
    await userEvent.click(screen.getByRole('button', { name: 'Copiar código Pix' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('MORADA042026');
    expect(await screen.findByRole('button', { name: 'Código Pix copiado!' })).toBeInTheDocument();
  });
});
