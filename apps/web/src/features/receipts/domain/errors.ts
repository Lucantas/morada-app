export class ReceiptNotFoundError extends Error {
  constructor(id: string) {
    super(`Recibo não encontrado: ${id}`);
    this.name = 'ReceiptNotFoundError';
  }
}
