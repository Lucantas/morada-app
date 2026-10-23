import { CloudflareEmailSender, type CloudflareEmailConfig } from './cloudflare-email-sender';
import { DisabledEmailSender, type EmailSender } from './email-sender';
import { InMemoryEmailSender } from './in-memory-email-sender';

export function createEmailSender(cfg: {
  email: Omit<CloudflareEmailConfig, 'fetchFn'> | null;
  isProduction: boolean;
}): EmailSender {
  if (cfg.email) return new CloudflareEmailSender(cfg.email);
  return cfg.isProduction ? new DisabledEmailSender() : new InMemoryEmailSender();
}
