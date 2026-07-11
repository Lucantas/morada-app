export class DashboardNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Resumo do painel não encontrado');
    this.name = 'DashboardNotFoundError';
  }
}
