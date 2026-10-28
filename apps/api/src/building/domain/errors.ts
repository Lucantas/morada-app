export class ApartmentNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Apartamento não encontrado');
    this.name = 'ApartmentNotFoundError';
  }
}

export class ApartmentConflictError extends Error {
  readonly status = 409;
  constructor() {
    super('Já existe um apartamento com esse nome');
    this.name = 'ApartmentConflictError';
  }
}

export class ApartmentOccupiedError extends Error {
  readonly status = 409;
  constructor() {
    super('Apartamento com morador ativo');
    this.name = 'ApartmentOccupiedError';
  }
}

export class ApartmentValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ApartmentValidationError';
  }
}
