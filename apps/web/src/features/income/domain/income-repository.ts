import type { Income, IncomeDraft } from './income';

export interface IncomeRepository {
  list(): Promise<Income[]>;
  save(draft: IncomeDraft): Promise<Income>;
  archive(id: string): Promise<void>;
}
