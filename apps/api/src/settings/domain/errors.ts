export class SettingsValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}
