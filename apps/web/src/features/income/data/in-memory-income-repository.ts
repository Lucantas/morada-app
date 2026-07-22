import { incomeSchema, type Income, type IncomeDraft } from '../domain/income';
import type { IncomeRepository } from '../domain/income-repository';

export class InMemoryIncomeRepository implements IncomeRepository {
  private incomes: Map<string, Income>;

  constructor(seed: readonly unknown[] = []) {
    this.incomes = new Map(
      seed.map((raw) => incomeSchema.parse(raw)).map((income) => [income.id, income]),
    );
  }

  async list(): Promise<Income[]> {
    return [...this.incomes.values()];
  }

  async save(draft: IncomeDraft): Promise<Income> {
    const income = incomeSchema.parse({
      ...draft,
      id: draft.id ?? crypto.randomUUID(),
    });
    this.incomes = new Map(this.incomes).set(income.id, income);
    return income;
  }

  async archive(id: string): Promise<void> {
    const next = new Map(this.incomes);
    next.delete(id);
    this.incomes = next;
  }
}
