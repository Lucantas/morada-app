export class NoticeNotFoundError extends Error {
  constructor(id: string) {
    super(`Aviso não encontrado: ${id}`);
    this.name = 'NoticeNotFoundError';
  }
}

export class NoticeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoticeValidationError';
  }
}
