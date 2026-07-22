import { ApiError, createApiClient } from './api-client';

function mockFetch(response: { ok: boolean; status: number; json?: unknown }) {
  return jest.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
  });
}

describe('createApiClient', () => {
  const client = () => createApiClient({ baseUrl: 'http://api.test' });

  beforeEach(() => {
    Object.defineProperty(document, 'cookie', { value: '', configurable: true });
  });

  test('sends credentials always and X-CSRF-Token on mutations', async () => {
    Object.defineProperty(document, 'cookie', { value: 'csrf=tok', configurable: true });
    const fetchMock = mockFetch({ ok: true, status: 204 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const apiClient = createApiClient({ baseUrl: 'http://x' });
    await apiClient.post('/api/thing', { a: 1 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok');
  });

  test('sends credentials on GET but omits X-CSRF-Token', async () => {
    Object.defineProperty(document, 'cookie', { value: 'csrf=tok', configurable: true });
    const fetchMock = mockFetch({ ok: true, status: 200, json: [{ id: 'r-1' }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await client().get('/api/residents');

    expect(result).toEqual([{ id: 'r-1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/residents');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  test('serializes the body on POST', async () => {
    const fetchMock = mockFetch({ ok: true, status: 201, json: { id: 'x' } });
    global.fetch = fetchMock as unknown as typeof fetch;

    await client().post('/api/residents', { name: 'Ana' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Ana' }));
  });

  test('omits X-CSRF-Token on mutations when the csrf cookie is absent', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    await client().post('/api/residents', { name: 'Ana' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  test('never sends an Authorization header', async () => {
    Object.defineProperty(document, 'cookie', { value: 'csrf=tok', configurable: true });
    const fetchMock = mockFetch({ ok: true, status: 200, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    await client().post('/api/residents', { name: 'Ana' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
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

  test('calls onUnauthorized on a 401 response', async () => {
    global.fetch = mockFetch({
      ok: false,
      status: 401,
      json: { error: 'Sessão expirada' },
    }) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();

    await expect(
      createApiClient({ baseUrl: 'http://api.test', onUnauthorized }).get('/api/accounts'),
    ).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('ApiError is an Error subclass', () => {
    expect(new ApiError(404, 'x')).toBeInstanceOf(Error);
  });
});
