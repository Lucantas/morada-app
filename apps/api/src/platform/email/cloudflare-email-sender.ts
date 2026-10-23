import { EmailDeliveryError, type EmailMessage, type EmailSender } from './email-sender';

export interface CloudflareEmailConfig {
  accountId: string;
  apiToken: string;
  from: string;
  fetchFn?: typeof fetch;
}

const SENDER_NAME = 'Morada';

export class CloudflareEmailSender implements EmailSender {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly cfg: CloudflareEmailConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
  }

  async send(message: EmailMessage): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfg.accountId}/email/sending/send`;
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: message.to,
          from: { address: this.cfg.from, name: SENDER_NAME },
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
    } catch {
      throw new EmailDeliveryError();
    }
    if (!response.ok) throw new EmailDeliveryError();
  }
}
