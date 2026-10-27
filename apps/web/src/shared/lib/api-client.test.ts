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

  test('sends the view header when a view is set', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createApiClient({ baseUrl: 'http://api.test', view: () => 'resident' }).get('/me');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['X-Morada-View']).toBe('resident');
  });

  test('omits the view header when the view is null', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: {} });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createApiClient({ baseUrl: 'http://api.test', view: () => null }).get('/me');

    const [, init] = fetchMock.mock.calls[0];
    expect('X-Morada-View' in (init.headers as Record<string, string>)).toBe(false);
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

  test('prefixes /api paths with the current condo', async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, json: [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createApiClient({ baseUrl: 'http://api.test', condoId: () => 'c1' }).get(
      '/api/residents',
    );

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/condos/c1/residents');
  });

  test('leaves /auth and /me paths alone', async () => {
    const fetchMock = mockFetch({ ok: true, status: 204 });
    global.fetch = fetchMock as unknown as typeof fetch;
    const apiClient = createApiClient({ baseUrl: 'http://api.test', condoId: () => 'c1' });

    await apiClient.post('/auth/logout');
    await apiClient.get('/me/condos');

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/auth/logout');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/me/condos');
  });

  test('treats a condo-not-found 404 as unauthorized', async () => {
    global.fetch = mockFetch({
      ok: false,
      status: 404,
      json: { error: 'Condomínio não encontrado' },
    }) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();

    await expect(
      createApiClient({ baseUrl: 'http://api.test', onUnauthorized, condoId: () => 'c1' }).get(
        '/api/residents',
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('does not sign out on any other 404', async () => {
    global.fetch = mockFetch({
      ok: false,
      status: 404,
      json: { error: 'Morador não encontrado' },
    }) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();

    await expect(
      createApiClient({ baseUrl: 'http://api.test', onUnauthorized, condoId: () => 'c1' }).get(
        '/api/residents/x',
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('ApiError is an Error subclass', () => {
    expect(new ApiError(404, 'x')).toBeInstanceOf(Error);
  });
});
