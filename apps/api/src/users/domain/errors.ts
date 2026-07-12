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

export class UserValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UserValidationError';
  }
}
