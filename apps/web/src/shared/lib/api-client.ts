import { readCookie } from './cookies';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type ApiClient = {
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  put(path: string, body?: unknown): Promise<unknown>;
  del(path: string): Promise<void>;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createApiClient(opts: { baseUrl: string; onUnauthorized?: () => void }): ApiClient {
  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const csrf = UNSAFE_METHODS.has(method) ? readCookie('csrf') : null;
    const res = await fetch(`${opts.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      // An expired/rejected token ends the session so the app returns to login.
      if (res.status === 401) opts.onUnauthorized?.();
      let message = `Erro ${res.status}`;
      try {
        const data = (await res.json()) as { error?: unknown };
        if (typeof data.error === 'string') message = data.error;
      } catch {
        // response had no JSON body; keep the generic message
      }
      throw new ApiError(res.status, message);
    }
    if (res.status === 204) return undefined;
    return res.json();
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: async (path) => {
      await request('DELETE', path);
    },
  };
}
