export class NoticeNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Aviso não encontrado: ${id}`);
    this.name = 'NoticeNotFoundError';
  }
}

export class NoticeValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'NoticeValidationError';
  }
}
