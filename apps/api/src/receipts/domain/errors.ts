export class ReceiptNotFoundError extends Error {
  readonly status = 404;
  constructor(id: string) {
    super(`Recibo não encontrado: ${id}`);
    this.name = 'ReceiptNotFoundError';
  }
}

export class PaymentError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class ReceiptValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptValidationError';
  }
}

export class ChargeResidentNotFoundError extends Error {
  readonly status = 404;
  constructor(residentId: string) {
    super(`Morador não encontrado para a cobrança: ${residentId}`);
    this.name = 'ChargeResidentNotFoundError';
  }
}
