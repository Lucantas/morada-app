import type { CondoSettings } from '../domain/condo-settings';
import { SettingsValidationError } from '../domain/errors';
import type { SettingsRepository } from '../domain/settings-repository';

import { updateSettings } from './update-settings';

const pix = {
  keyType: 'email',
  key: 'caixa@morada.com',
  receiverName: 'Condomínio Morada',
  city: 'Santos',
} as const;
const openingBalance = { valueCents: 1_230_000, date: '2026-10-27' };

function makeRepo(initial: CondoSettings): SettingsRepository {
  let stored = initial;
  return {
    get: async () => stored,
    save: async (settings) => {
      stored = settings;
      return stored;
    },
  };
}

describe('updateSettings', () => {
  const stored: CondoSettings = { monthlyFeeCents: 15000, dueDay: 15, pix, openingBalance };

  it('keeps the stored pix and opening balance when the input omits them', async () => {
    const repo = makeRepo(stored);

    const result = await updateSettings(repo, { monthlyFeeCents: 20000, dueDay: 10 });

    expect(result).toEqual({ monthlyFeeCents: 20000, dueDay: 10, pix, openingBalance });
  });

  it('clears the opening balance with null and keeps pix', async () => {
    const repo = makeRepo(stored);

    const result = await updateSettings(repo, {
      monthlyFeeCents: 15000,
      dueDay: 15,
      openingBalance: null,
    });

    expect(result).toEqual({ monthlyFeeCents: 15000, dueDay: 15, pix, openingBalance: null });
  });

  it('replaces the opening balance when given', async () => {
    const repo = makeRepo({ ...stored, openingBalance: null });

    const result = await updateSettings(repo, {
      monthlyFeeCents: 15000,
      dueDay: 15,
      openingBalance,
    });

    expect(result.openingBalance).toEqual(openingBalance);
  });

  it('rejects a negative opening balance', async () => {
    const repo = makeRepo(stored);

    await expect(
      updateSettings(repo, {
        monthlyFeeCents: 15000,
        dueDay: 15,
        openingBalance: { valueCents: -1, date: '2026-10-27' },
      }),
    ).rejects.toBeInstanceOf(SettingsValidationError);
  });
});
