export class AccountNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Conta não encontrada: ${id}`);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'AccountValidationError';
  }
}
