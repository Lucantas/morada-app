export class OrganizationNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Organização não encontrada');
    this.name = 'OrganizationNotFoundError';
  }
}

export class OrgMemberNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Membro não encontrado');
    this.name = 'OrgMemberNotFoundError';
  }
}

export class OrgCondoNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Condomínio não encontrado');
    this.name = 'OrgCondoNotFoundError';
  }
}

export class OrgInvitationNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Convite não encontrado');
    this.name = 'OrgInvitationNotFoundError';
  }
}

export class OwnerDeactivationError extends Error {
  readonly status = 409;
  constructor() {
    super('Não é possível desativar um dono');
    this.name = 'OwnerDeactivationError';
  }
}

export class SelfDeactivationError extends Error {
  readonly status = 409;
  constructor() {
    super('Você não pode se desativar');
    this.name = 'SelfDeactivationError';
  }
}

export class OwnerCondosError extends Error {
  readonly status = 409;
  constructor() {
    super('Um dono administra todos os condomínios');
    this.name = 'OwnerCondosError';
  }
}
