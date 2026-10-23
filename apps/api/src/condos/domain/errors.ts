export class CondoNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Condomínio não encontrado');
    this.name = 'CondoNotFoundError';
  }
}

export class CondoGrantValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CondoGrantValidationError';
  }
}

export class CondoValidationError extends Error {
  readonly status = 400;
  constructor() {
    super('Dados inválidos');
    this.name = 'CondoValidationError';
  }
}
