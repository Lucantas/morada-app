export class IncomeValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'IncomeValidationError';
  }
}
export class IncomeNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Entrada não encontrada: ${id}`);
    this.name = 'IncomeNotFoundError';
  }
}
