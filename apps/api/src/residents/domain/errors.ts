export class ResidentNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Morador não encontrado: ${id}`);
    this.name = 'ResidentNotFoundError';
  }
}

export class ResidentValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ResidentValidationError';
  }
}

export class ApartmentOccupiedError extends Error {
  readonly status = 409;
  constructor(apt: string) {
    super(`O apartamento já tem um morador ativo: ${apt}`);
    this.name = 'ApartmentOccupiedError';
  }
}
