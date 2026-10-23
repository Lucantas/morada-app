import { CloudflareEmailSender } from './cloudflare-email-sender';
import { createEmailSender } from './create-email-sender';
import { DisabledEmailSender } from './email-sender';
import { InMemoryEmailSender } from './in-memory-email-sender';

const email = { accountId: 'a', apiToken: 't', from: 'no-reply@x.com' };

describe('createEmailSender', () => {
  test('uses Cloudflare when credentials are configured', () => {
    expect(createEmailSender({ email, isProduction: true })).toBeInstanceOf(CloudflareEmailSender);
  });

  test('is disabled in production without credentials', () => {
    expect(createEmailSender({ email: null, isProduction: true })).toBeInstanceOf(
      DisabledEmailSender,
    );
  });

  test('keeps messages in memory outside production without credentials', () => {
    expect(createEmailSender({ email: null, isProduction: false })).toBeInstanceOf(
      InMemoryEmailSender,
    );
  });
});
