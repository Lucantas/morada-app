import { z } from 'zod';

import { answerSchema, restoreConversation, type ConversationState } from '../domain/conversation';
import type { DraftStore } from '../domain/draft-store';

export const DRAFT_KEY = 'morada-onboarding-draft';

const draftSchema = z.object({ answers: z.array(answerSchema) });

function parseDraft(raw: string): ConversationState | null {
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? restoreConversation(parsed.data.answers) : null;
  } catch {
    return null;
  }
}

export function loadDraft(): ConversationState | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw === null ? null : parseDraft(raw);
  } catch {
    return null;
  }
}

export function saveDraft(state: ConversationState): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: state.answers }));
  } catch {
    return;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

export const localDraftStore: DraftStore = { load: loadDraft, save: saveDraft, clear: clearDraft };
