import type { Income, IncomeDraft } from './income';

export interface IncomeRepository {
  list(): Promise<Income[]>;
  save(draft: IncomeDraft): Promise<Income>;
  remove(id: string): Promise<void>;
}
