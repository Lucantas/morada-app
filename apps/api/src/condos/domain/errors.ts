export class CondoNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Condomínio não encontrado');
    this.name = 'CondoNotFoundError';
  }
}
