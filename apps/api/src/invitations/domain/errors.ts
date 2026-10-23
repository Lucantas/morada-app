export class InvitationResidentNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Morador não encontrado: ${id}`);
    this.name = 'InvitationResidentNotFoundError';
  }
}

export class InvitationCondoNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Condomínio não encontrado');
    this.name = 'InvitationCondoNotFoundError';
  }
}
