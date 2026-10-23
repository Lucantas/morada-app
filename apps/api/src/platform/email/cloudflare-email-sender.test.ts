import { CloudflareEmailSender } from './cloudflare-email-sender';
import { EmailDeliveryError } from './email-sender';

const message = { to: 'a@x.com', subject: 'Oi', text: 'texto', html: '<p>texto</p>' };

function build(fetchFn: typeof fetch, timeoutMs?: number) {
  return new CloudflareEmailSender({
    accountId: 'acc1',
    apiToken: 'tok',
    from: 'no-reply@morada.app',
    fetchFn,
    timeoutMs,
  });
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

function waitForAbort(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
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

  test('is available', () => {
    expect(build(jest.fn()).isAvailable()).toBe(true);
  });

  test('throws EmailDeliveryError carrying the upstream status on a non-2xx response', async () => {
    const fetchFn = jest.fn(async () => new Response('nope', { status: 500 }));

    const error = await rejectionOf(build(fetchFn).send(message));

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({ upstreamStatus: 500 });
    expect(JSON.stringify(error)).not.toContain('tok');
  });

  test('throws EmailDeliveryError marked network when the request itself fails', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('network down');
    });

    const error = await rejectionOf(build(fetchFn).send(message));

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({ upstreamStatus: 'network' });
  });

  test('gives up after the timeout with an EmailDeliveryError marked timeout', async () => {
    const error = await rejectionOf(build(waitForAbort, 5).send(message));

    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error).toMatchObject({ upstreamStatus: 'timeout' });
  });

  test('sends with an abort signal by default', async () => {
    const fetchFn = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async () => new Response('{}', { status: 200 }),
    );

    await build(fetchFn).send(message);

    expect(fetchFn.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
