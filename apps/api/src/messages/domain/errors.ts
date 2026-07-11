export class ThreadNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Conversa não encontrada: ${id}`);
    this.name = 'ThreadNotFoundError';
  }
}

export class EmptyMessageError extends Error {
  readonly status = 400;
  constructor() {
    super('Mensagem não pode ser vazia');
    this.name = 'EmptyMessageError';
  }
}
