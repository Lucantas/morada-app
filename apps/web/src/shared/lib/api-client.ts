import { scopedApiPath } from './condo-scope';
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

const CONDO_NOT_FOUND = 'Condomínio não encontrado';

export function createApiClient(opts: {
  baseUrl: string;
  onUnauthorized?: () => void;
  condoId?: () => string | null;
  view?: () => 'admin' | 'resident' | null;
}): ApiClient {
  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const csrf = UNSAFE_METHODS.has(method) ? readCookie('csrf') : null;
    const target = opts.condoId ? scopedApiPath(path, opts.condoId()) : path;
    const view = opts.view?.() ?? null;
    const res = await fetch(`${opts.baseUrl}${target}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...(view ? { 'X-Morada-View': view } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let message = `Erro ${res.status}`;
      try {
        const data = (await res.json()) as { error?: unknown };
        if (typeof data.error === 'string') message = data.error;
      } catch {
        // response had no JSON body; keep the generic message
      }
      const lostCondo = res.status === 404 && message === CONDO_NOT_FOUND;
      if (res.status === 401 || lostCondo) opts.onUnauthorized?.();
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
