import { ApiError, createApiClient } from './api-client';

function mockFetch(response: { ok: boolean; status: number; json?: unknown }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
  });
}

describe('createApiClient', () => {
  const client = () => createApiClient({ baseUrl: 'http://api.test', getToken: () => 'tok-123' });

  test('sends the bearer token and returns parsed JSON', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: [{ id: 'r-1' }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await client().get('/api/residents');

    expect(result).toEqual([{ id: 'r-1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/residents');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  test('serializes the body on POST', async () => {
    const fetchMock = mockFetch({ ok: true, status: 201, json: { id: 'x' } });
    global.fetch = fetchMock as unknown as typeof fetch;

    await client().post('/api/residents', { name: 'Ana' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Ana' }));
  });

  test('throws ApiError carrying status and server message on failure', async () => {
    global.fetch = mockFetch({
      ok: false,
      status: 403,
      json: { error: 'Acesso negado' },
    }) as unknown as typeof fetch;

    await expect(client().get('/api/accounts')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Acesso negado',
    });
  });

  test('resolves void for 204 responses', async () => {
    global.fetch = mockFetch({ ok: true, status: 204 }) as unknown as typeof fetch;
    await expect(client().del('/api/notices/n-1')).resolves.toBeUndefined();
  });

  test('omits Authorization when there is no token', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createApiClient({ baseUrl: 'http://api.test', getToken: () => null }).get('/x');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test('ApiError is an Error subclass', () => {
    expect(new ApiError(404, 'x')).toBeInstanceOf(Error);
  });
});
