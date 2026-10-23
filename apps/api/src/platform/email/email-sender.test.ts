import {
  DisabledEmailSender,
  EmailDeliveryError,
  EmailUnavailableError,
  type EmailSender,
} from './email-sender';
import { InMemoryEmailSender } from './in-memory-email-sender';

const message = (to: string, subject = 's') => ({ to, subject, text: 't', html: '<p>t</p>' });

describe('InMemoryEmailSender', () => {
  test('records sent messages in order', async () => {
    const sender = new InMemoryEmailSender();

    await sender.send(message('a@x.com'));
    await sender.send(message('b@x.com'));

    expect(sender.sent.map((m) => m.to)).toEqual(['a@x.com', 'b@x.com']);
  });

  test('lastTo returns the latest message for a recipient', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send(message('a@x.com', 'first'));
    await sender.send(message('b@x.com'));
    await sender.send(message('a@x.com', 'second'));

    expect(sender.lastTo('a@x.com')?.subject).toBe('second');
    expect(sender.lastTo('nobody@x.com')).toBeUndefined();
  });
});

describe('isAvailable', () => {
  test('is false only for the disabled sender', () => {
    expect(new DisabledEmailSender().isAvailable()).toBe(false);
    expect(new InMemoryEmailSender().isAvailable()).toBe(true);
  });
});

describe('DisabledEmailSender', () => {
  test('rejects with a 503 EmailUnavailableError', async () => {
    const sender: EmailSender = new DisabledEmailSender();
    const rejection = sender.send(message('a@x.com'));

    await expect(rejection).rejects.toBeInstanceOf(EmailUnavailableError);
    await expect(rejection).rejects.toMatchObject({
      status: 503,
      message: 'Envio de e-mail indisponível',
    });
  });
});

describe('EmailDeliveryError', () => {
  test('carries status 502, a user-facing message and the upstream status', () => {
    const error = new EmailDeliveryError(429);

    expect(error.status).toBe(502);
    expect(error.message).toBe('Não foi possível enviar o e-mail');
    expect(error.upstreamStatus).toBe(429);
  });
});
