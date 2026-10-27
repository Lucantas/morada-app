import type { CondoSettings } from './condo-settings';
import { pixSettingsSchema, type PixKeyType, type PixSettings } from './pix-settings';

export interface PixDraft {
  readonly keyType: PixKeyType;
  readonly key: string;
  readonly receiverName: string;
  readonly city: string;
}

export const EMPTY_PIX_DRAFT: PixDraft = {
  keyType: 'cpf',
  key: '',
  receiverName: '',
  city: '',
};

export function draftFromPix(pix: CondoSettings['pix']): PixDraft {
  return pix === null ? EMPTY_PIX_DRAFT : { ...pix };
}

function isBlank(draft: PixDraft): boolean {
  return [draft.key, draft.receiverName, draft.city].every((value) => value.trim() === '');
}

function isSamePix(left: PixSettings, right: PixSettings): boolean {
  return (
    left.keyType === right.keyType &&
    left.key === right.key &&
    left.receiverName === right.receiverName &&
    left.city === right.city
  );
}

export function pixUpdateFor(
  stored: CondoSettings['pix'],
  draft: PixDraft,
): PixSettings | null | undefined {
  if (isBlank(draft)) return stored === null ? undefined : null;
  const parsed = pixSettingsSchema.safeParse(draft);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Chave Pix inválida');
  return stored !== null && isSamePix(stored, parsed.data) ? undefined : parsed.data;
}
