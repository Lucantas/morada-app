import { CloudflareEmailSender } from './cloudflare-email-sender';
import { EmailDeliveryError } from './email-sender';

const message = { to: 'a@x.com', subject: 'Oi', text: 'texto', html: '<p>texto</p>' };

function build(fetchFn: typeof fetch) {
  return new CloudflareEmailSender({
    accountId: 'acc1',
    apiToken: 'tok',
    from: 'no-reply@morada.app',
    fetchFn,
  });
}

describe('CloudflareEmailSender', () => {
  test('POSTs the message to the Cloudflare email sending endpoint', async () => {
    const fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () => new Response('{}', { status: 200 }),
    );

    await build(fetchFn).send(message);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc1/email/sending/send');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      to: 'a@x.com',
      from: { address: 'no-reply@morada.app', name: 'Morada' },
      subject: 'Oi',
      html: '<p>texto</p>',
      text: 'texto',
    });
  });

  test('throws EmailDeliveryError on a non-2xx response', async () => {
    const fetchFn = jest.fn(async () => new Response('nope', { status: 500 }));

    await expect(build(fetchFn).send(message)).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  test('throws EmailDeliveryError when the request itself fails', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(build(fetchFn).send(message)).rejects.toBeInstanceOf(EmailDeliveryError);
  });
});
