import { randomUUID } from 'node:crypto';

import type { ResidentRepository } from '../../residents/domain/resident-repository';
import type { SettingsRepository } from '../../settings/domain/settings-repository';
import { MonthlyReceiptExistsError } from '../domain/errors';
import { ensureMonthlyReceipts } from '../domain/monthly-receipts';
import { receiptSchema, type Receipt } from '../domain/receipt';
import type { ReceiptRepository } from '../domain/receipt-repository';

export async function generateMonthlyReceipts(
  receipts: ReceiptRepository,
  residents: ResidentRepository,
  settings: SettingsRepository,
  today: string,
): Promise<Receipt[]> {
  const [activeResidents, existing, condoSettings] = await Promise.all([
    residents.list(),
    receipts.list(),
    settings.get(),
  ]);

  const drafts = ensureMonthlyReceipts({
    residents: activeResidents.map((r) => ({ id: r.id, apartmentId: r.apartmentId })),
    receipts: existing.map((r) => ({ residentId: r.residentId, ref: r.ref, title: r.title })),
    settings: condoSettings,
    today,
  });

  const created: Receipt[] = [];
  for (const draft of drafts) {
    const receipt = receiptSchema.parse({ ...draft, id: randomUUID() });
    try {
      created.push(await receipts.save(receipt));
    } catch (error) {
      // A concurrent ensure-month call already created this resident's receipt
      // for the month (DB unique-index race): idempotent under race counts as
      // success, so skip it and keep generating the rest.
      if (!(error instanceof MonthlyReceiptExistsError)) throw error;
    }
  }
  return created;
}
