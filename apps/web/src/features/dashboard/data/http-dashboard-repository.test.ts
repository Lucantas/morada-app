import type { ApiClient } from '@/shared/lib/api-client';
import { buildDashboardSummary } from '@/test/factories.dashboard';

import { HttpDashboardRepository } from './http-dashboard-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpDashboardRepository', () => {
  test('getSummary parses the GET /api/dashboard response', async () => {
    const summary = buildDashboardSummary();
    const api = fakeApi({ get: jest.fn().mockResolvedValue(summary) });

    const result = await new HttpDashboardRepository(api).getSummary();

    expect(api.get).toHaveBeenCalledWith('/api/dashboard');
    expect(result).toEqual(summary);
  });
});
