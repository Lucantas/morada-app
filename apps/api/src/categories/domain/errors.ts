export class CategoryValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CategoryValidationError';
  }
}
