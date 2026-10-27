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

export class InvalidInvitationError extends Error {
  readonly status = 404;
  constructor() {
    super('Convite inválido ou expirado');
    this.name = 'InvalidInvitationError';
  }
}

export class PendingInvitationConflictError extends Error {
  readonly status = 409;
  constructor() {
    super('Já existe um convite pendente');
    this.name = 'PendingInvitationConflictError';
  }
}

export class InactiveResidentError extends Error {
  readonly status = 409;
  constructor() {
    super('Morador inativo');
    this.name = 'InactiveResidentError';
  }
}

export class InvitationOrganizationNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Organização não encontrada');
    this.name = 'InvitationOrganizationNotFoundError';
  }
}
