import { formatIsoDate } from '@/shared/lib/dates';
import { formatBRL } from '@/shared/lib/money';

import type { Receipt, ReceiptMethod } from './receipt';

const METHOD_LABELS: Record<ReceiptMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function aptNumber(apt: string): string {
  return apt.replace(/^apto\s+/i, '').trim();
}

function detailRow(label: string, value: string): string {
  return `<div class="row"><span class="row-label">${escapeHtml(label)}</span><span class="row-value">${escapeHtml(value)}</span></div>`;
}

// A styled, self-contained HTML payment proof for a paid receipt, offered as a
// download. Real receipt data is escaped and laid over a fixed template.
export function buildReceiptProof(
  receipt: Receipt,
  resident: { name: string; apt: string },
): string {
  const rows = [
    detailRow('Referência', receipt.ref),
    detailRow('Descrição', receipt.title),
    receipt.method ? detailRow('Forma de pagamento', METHOD_LABELS[receipt.method]) : '',
    receipt.dueDate ? detailRow('Vencimento', formatIsoDate(receipt.dueDate)) : '',
    receipt.paidAt ? detailRow('Pago em', formatIsoDate(receipt.paidAt)) : '',
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Comprovante · ${escapeHtml(receipt.ref)}</title>
<style>
  :root {
    --ink: #1f2933;
    --muted: #6b7280;
    --line: #e7e9ee;
    --surface: #f7f8fa;
    --pago-bg: #e6f6ec;
    --pago-fg: #1c7a45;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #eef0f4;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 32px 16px;
  }
  .sheet {
    max-width: 640px;
    margin: 0 auto;
    background: #fff;
    border-radius: 14px;
    padding: 40px 44px 34px;
    box-shadow: 0 10px 40px rgba(31, 41, 51, 0.08);
  }
  .title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.55rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .subtitle { margin: 2px 0 0; color: var(--muted); font-size: 0.95rem; }
  .divider { border: none; border-top: 1px solid var(--line); margin: 22px 0; }
  .badge-wrap { text-align: center; margin: 4px 0 26px; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--pago-bg);
    color: var(--pago-fg);
    font-weight: 700;
    font-size: 0.9rem;
    padding: 9px 20px;
    border-radius: 999px;
  }
  .badge::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
  .amount {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 26px;
  }
  .amount-label {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  .amount-value {
    margin: 6px 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 2.1rem;
    font-weight: 700;
  }
  .section-label {
    margin: 0 0 4px;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }
  .section { margin-bottom: 26px; }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 0;
    border-bottom: 1px solid var(--line);
  }
  .row:last-child { border-bottom: none; }
  .row-label { color: var(--muted); font-size: 0.92rem; }
  .row-value { font-weight: 700; font-size: 0.95rem; text-align: right; }
  .footer {
    margin: 4px 0 0;
    text-align: center;
    color: var(--muted);
    font-size: 0.78rem;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; max-width: none; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <header>
      <h1 class="title">Condomínio · Bloco 2</h1>
      <p class="subtitle">Comprovante de pagamento</p>
    </header>
    <hr class="divider" />
    <div class="badge-wrap"><span class="badge">Pago</span></div>
    <div class="amount">
      <p class="amount-label">Valor pago</p>
      <p class="amount-value">R$ ${escapeHtml(formatBRL(receipt.valueCents))}</p>
    </div>
    <section class="section">
      <p class="section-label">Dados do morador</p>
      ${detailRow('Morador', resident.name)}
      ${detailRow('Apartamento', aptNumber(resident.apt))}
    </section>
    <section class="section">
      <p class="section-label">Detalhes do pagamento</p>
      ${rows}
    </section>
    <hr class="divider" />
    <p class="footer">Este comprovante é um documento gerado automaticamente pelo aplicativo do condomínio e não possui validade fiscal.</p>
  </main>
</body>
</html>`;
}

export function proofFileName(receipt: Pick<Receipt, 'ref'>): string {
  return `comprovante-morada-${receipt.ref.replace(/\D/g, '')}.html`;
}
