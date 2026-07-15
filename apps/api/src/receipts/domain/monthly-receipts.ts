export const CONDO_FEE_TITLE = 'Taxa condominial';

export interface MonthlyReceiptDraft {
  residentId: string;
  apartmentId: string;
  ref: string;
  title: string;
  valueCents: number;
  dueDate: string;
  status: 'pendente';
}

export function monthlyRef(today: string): string {
  const [year, month] = today.split('-');
  return `${month}/${year}`;
}

export function monthlyDueDate(today: string, dueDay: number): string {
  const [year, month] = today.split('-');
  return `${year}-${month}-${String(dueDay).padStart(2, '0')}`;
}

export function ensureMonthlyReceipts(input: {
  residents: { id: string; apartmentId: string }[];
  receipts: { residentId?: string; ref: string; title: string }[];
  settings: { monthlyFeeCents: number; dueDay: number };
  today: string;
}): MonthlyReceiptDraft[] {
  const ref = monthlyRef(input.today);
  const dueDate = monthlyDueDate(input.today, input.settings.dueDay);
  const covered = new Set(
    input.receipts
      .filter((r) => r.title === CONDO_FEE_TITLE && r.ref === ref && r.residentId !== undefined)
      .map((r) => r.residentId),
  );
  return input.residents
    .filter((r) => !covered.has(r.id))
    .map((r) => ({
      residentId: r.id,
      apartmentId: r.apartmentId,
      ref,
      title: CONDO_FEE_TITLE,
      valueCents: input.settings.monthlyFeeCents,
      dueDate,
      status: 'pendente' as const,
    }));
}
