export class SettingsValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}

export class SettingsNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super('Configurações não encontradas');
    this.name = 'SettingsNotFoundError';
  }
}
