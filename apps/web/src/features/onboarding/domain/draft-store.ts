import type { ConversationState } from './conversation';

export interface DraftStore {
  load(): ConversationState | null;
  save(state: ConversationState): void;
  clear(): void;
}
