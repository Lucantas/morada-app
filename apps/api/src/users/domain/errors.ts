export class InvalidCredentialsError extends Error {
  readonly status = 401;
  constructor() {
    super('Usuário ou senha inválidos');
    this.name = 'InvalidCredentialsError';
  }
}

export class UsernameTakenError extends Error {
  readonly status = 409;
  constructor(username: string) {
    super(`Usuário já existe: ${username}`);
    this.name = 'UsernameTakenError';
  }
}

export class EmailTakenError extends Error {
  readonly status = 409;
  constructor(email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = 'EmailTakenError';
  }
}

export class UserValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UserValidationError';
  }
}

export class UnknownResidentError extends Error {
  readonly status = 404;
  constructor(residentId: string) {
    super(`Morador não encontrado: ${residentId}`);
    this.name = 'UnknownResidentError';
  }
}

export class ResidentLoginExistsError extends Error {
  readonly status = 409;
  constructor(residentId: string) {
    super(`Este morador já possui um acesso: ${residentId}`);
    this.name = 'ResidentLoginExistsError';
  }
}

export class ResidentLoginNotFoundError extends Error {
  readonly status = 404;
  constructor(residentId: string) {
    super(`Este morador não possui um acesso: ${residentId}`);
    this.name = 'ResidentLoginNotFoundError';
  }
}

export class InvalidLinkError extends Error {
  readonly status = 404;
  constructor() {
    super('Link inválido ou expirado');
    this.name = 'InvalidLinkError';
  }
}
