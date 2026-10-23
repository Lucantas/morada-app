export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class EmailUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super('Envio de e-mail indisponível');
    this.name = 'EmailUnavailableError';
  }
}

export class EmailDeliveryError extends Error {
  readonly status = 502;
  constructor() {
    super('Não foi possível enviar o e-mail');
    this.name = 'EmailDeliveryError';
  }
}

export class DisabledEmailSender implements EmailSender {
  send(): Promise<void> {
    return Promise.reject(new EmailUnavailableError());
  }
}
