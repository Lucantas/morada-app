export class ResidentNotFoundError extends Error {
  constructor(id: string) {
    super(`Morador não encontrado: ${id}`);
    this.name = 'ResidentNotFoundError';
  }
}

export class ResidentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResidentValidationError';
  }
}
