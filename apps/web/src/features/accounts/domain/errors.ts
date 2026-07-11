export class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Conta não encontrada: ${id}`);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountValidationError';
  }
}
