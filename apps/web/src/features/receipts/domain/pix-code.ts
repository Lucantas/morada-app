import type { Receipt } from './receipt';

// A Pix "copia e cola" payload for the receipt. This is a demo payload (not a
// bank-registered key), enough for the copy-to-clipboard flow in the prototype.
export function pixCopyPaste(receipt: Pick<Receipt, 'valueCents' | 'ref'>): string {
  const amount = (receipt.valueCents / 100).toFixed(2);
  const txid = `MORADA${receipt.ref.replace(/\D/g, '')}`;
  return [
    '00020126',
    '580014br.gov.bcb.pix',
    '0136morada.bloco2@condominio.com.br',
    '52040000',
    '5303986',
    `54${String(amount.length).padStart(2, '0')}${amount}`,
    '5802BR',
    '5915CONDOMINIO MORADA',
    '6009SAO PAULO',
    `62${String(txid.length + 4).padStart(2, '0')}05${String(txid.length).padStart(2, '0')}${txid}`,
  ].join('');
}
