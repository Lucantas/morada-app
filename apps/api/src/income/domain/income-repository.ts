import type { Income } from './income';

export interface IncomeRepository {
  list(): Promise<Income[]>;
  getById(id: string): Promise<Income | null>;
  save(income: Income): Promise<Income>;
  archive(id: string): Promise<void>;
}
