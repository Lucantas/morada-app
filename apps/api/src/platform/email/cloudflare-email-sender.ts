import { EmailDeliveryError, type EmailMessage, type EmailSender } from './email-sender';

export const EMAIL_SEND_TIMEOUT_MS = 10_000;

export interface CloudflareEmailConfig {
  accountId: string;
  apiToken: string;
  from: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const SENDER_NAME = 'Morada';

function isTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError'
  );
}

export class CloudflareEmailSender implements EmailSender {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: CloudflareEmailConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.timeoutMs = cfg.timeoutMs ?? EMAIL_SEND_TIMEOUT_MS;
  }

  isAvailable(): boolean {
    return true;
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
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new EmailDeliveryError(isTimeout(error) ? 'timeout' : 'network');
    }
    if (!response.ok) throw new EmailDeliveryError(response.status);
  }
}
