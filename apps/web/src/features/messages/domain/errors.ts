export class ThreadNotFoundError extends Error {
  constructor(id: string) {
    super(`Conversa não encontrada: ${id}`);
    this.name = 'ThreadNotFoundError';
  }
}

export class EmptyMessageError extends Error {
  constructor() {
    super('A mensagem não pode ser vazia');
    this.name = 'EmptyMessageError';
  }
}
