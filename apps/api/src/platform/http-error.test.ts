import { Hono } from 'hono';

import { EmailDeliveryError, EmailUnavailableError } from './email/email-sender';
import { logServerError, onError } from './http-error';

function appThrowing(error: Error) {
  const app = new Hono();
  app.onError(onError);
  app.get('/', () => {
    throw error;
  });
  return app;
}

describe('onError', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  test('hides an unexpected error behind a 500 and logs it', async () => {
    const boom = new Error('SELECT secret FROM x');

    const res = await appThrowing(boom).request('/');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Erro interno' });
    expect(logged).toHaveBeenCalledWith('Unhandled error:', boom);
  });

  test('answers an e-mail delivery failure with its message and logs it', async () => {
    const failure = new EmailDeliveryError(503);

    const res = await appThrowing(failure).request('/');

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Não foi possível enviar o e-mail' });
    expect(logged).toHaveBeenCalledWith('E-mail delivery failed:', failure);
  });

  test('does not log a typed client error or a disabled sender', async () => {
    const notFound = Object.assign(new Error('Não encontrado'), { status: 404 });

    const missing = await appThrowing(notFound).request('/');
    const disabled = await appThrowing(new EmailUnavailableError()).request('/');

    expect([missing.status, disabled.status]).toEqual([404, 503]);
    expect(logged).not.toHaveBeenCalled();
  });
});

describe('logServerError', () => {
  test('writes the label and the error to the server log', () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new EmailDeliveryError('network');

    logServerError('E-mail delivery failed:', failure);

    expect(logged).toHaveBeenCalledWith('E-mail delivery failed:', failure);
    logged.mockRestore();
  });
});
