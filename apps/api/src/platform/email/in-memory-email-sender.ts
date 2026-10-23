import type { EmailMessage, EmailSender } from './email-sender';

export class InMemoryEmailSender implements EmailSender {
  private messages: readonly EmailMessage[] = [];

  get sent(): readonly EmailMessage[] {
    return this.messages;
  }

  send(message: EmailMessage): Promise<void> {
    this.messages = [...this.messages, message];
    return Promise.resolve();
  }

  isAvailable(): boolean {
    return true;
  }

  lastTo(to: string): EmailMessage | undefined {
    return this.messages.filter((m) => m.to === to).at(-1);
  }
}
