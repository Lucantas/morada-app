import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';

import { formatBRL } from '@/shared/lib/money';
import { Icon } from '@/shared/ui/icon';
import { Screen, ScreenBody } from '@/shared/ui/app-shell';
import { PrimaryButton } from '@/shared/ui/primitives';

import { getReceipt } from '../domain/get-receipt';
import { pixCopyPaste } from '../domain/pix-code';
import { fileToDataUrl, isAllowedProof } from '../domain/proof';
import type { ReceiptMethod } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

import { methodLabel } from './receipt-status-view';
import { receiptsQueryKey, useSubmitPayment } from './use-receipts';
import { PaySkeleton } from './pay-skeleton';

const METHODS: ReceiptMethod[] = ['dinheiro', 'pix'];

type Props = {
  repository: ReceiptRepository;
  receiptId: string;
  onDone: () => void;
};

export function PayScreen({ repository, receiptId, onDone }: Props) {
  const receipt = useQuery({
    queryKey: [...receiptsQueryKey, receiptId],
    queryFn: () => getReceipt(repository, receiptId),
  });
  const submitPayment = useSubmitPayment(repository);
  const [method, setMethod] = useState<ReceiptMethod>('pix');
  const [pixCopied, setPixCopied] = useState(false);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const confirm = () => {
    if (!proofDataUrl) return;
    submitPayment.mutate({ id: receiptId, method, proofDataUrl }, { onSuccess: onDone });
  };

  const copyPix = async () => {
    if (!receipt.data) return;
    await navigator.clipboard.writeText(pixCopyPaste(receipt.data));
    setPixCopied(true);
  };

  const handleProofChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setProofDataUrl(null);
      setProofError(null);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    if (!isAllowedProof(dataUrl)) {
      setProofDataUrl(null);
      setProofError('Envie uma imagem ou PDF do comprovante.');
      return;
    }
    setProofDataUrl(dataUrl);
    setProofError(null);
  };

  return (
    <Screen>
      <div
        style={{
          background: 'var(--petrol-800)',
          color: '#fff',
          padding: '18px 18px 20px',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onDone}
          aria-label="Voltar"
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: 'rgba(255,255,255,.12)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            flex: 'none',
          }}
        >
          <Icon name="chevronLeft" color="#fff" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.78rem', color: '#A9C6C9', fontWeight: 500 }}>
            Recibos · Bloco 2
          </div>
          <div className="fraunces" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#fff' }}>
            Pagar taxa
          </div>
        </div>
      </div>
      <ScreenBody>
        {receipt.isLoading && <PaySkeleton />}
        {receipt.isError && (
          <p style={{ color: 'var(--atraso-700)' }}>Não foi possível carregar o recibo.</p>
        )}
        {receipt.isSuccess && (
          <div style={{ paddingTop: 2 }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                padding: '14px 15px',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: '.72rem',
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-500)',
                  fontWeight: 600,
                }}
              >
                REF · {receipt.data.ref}
              </div>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: 2 }}>
                {receipt.data.title}
              </div>
              <div
                className="fraunces"
                style={{ fontSize: '1.55rem', fontWeight: 700, marginTop: 8 }}
              >
                R$ {formatBRL(receipt.data.valueCents)}
              </div>
            </div>

            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '.9rem',
                marginBottom: 9,
                color: 'var(--ink-900)',
              }}
            >
              Forma de pagamento
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {METHODS.map((option) => {
                const active = method === option;
                return (
                  <button
                    key={option}
                    onClick={() => setMethod(option)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      borderRadius: 'var(--r-sm)',
                      border: `1.5px solid ${active ? 'var(--petrol-600)' : 'var(--line)'}`,
                      background: active ? 'var(--petrol-50)' : 'var(--surface)',
                      color: active ? 'var(--petrol-800)' : 'var(--ink-500)',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      fontSize: '.86rem',
                      cursor: 'pointer',
                    }}
                  >
                    {methodLabel(option)}
                  </button>
                );
              })}
            </div>

            {method === 'pix' && receipt.data && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    background: '#fff',
                  }}
                >
                  <QRCodeSVG value={pixCopyPaste(receipt.data)} size={136} />
                </div>
                <button
                  type="button"
                  onClick={() => void copyPix()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    border: '1.5px solid var(--line)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 16px',
                    color: 'var(--petrol-800)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '.86rem',
                    cursor: 'pointer',
                  }}
                >
                  {pixCopied ? 'Código Pix copiado!' : 'Copiar código Pix'}
                </button>
              </div>
            )}

            <label
              htmlFor="payment-proof"
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: '.9rem',
                marginBottom: 9,
                color: 'var(--ink-900)',
              }}
            >
              Comprovante de pagamento
            </label>
            <input
              id="payment-proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => void handleProofChange(event)}
              style={{
                display: 'block',
                width: '100%',
                marginBottom: 8,
                fontFamily: "'Inter', sans-serif",
                fontSize: '.86rem',
              }}
            />

            {proofError && (
              <p style={{ color: 'var(--atraso-700)', marginBottom: 12, fontSize: '.88rem' }}>
                {proofError}
              </p>
            )}

            {submitPayment.isError && (
              <p style={{ color: 'var(--atraso-700)', marginBottom: 12, fontSize: '.88rem' }}>
                Não foi possível enviar o comprovante. Tente novamente.
              </p>
            )}

            <PrimaryButton icon="check" onClick={confirm} disabled={!proofDataUrl}>
              Enviar comprovante
            </PrimaryButton>
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
