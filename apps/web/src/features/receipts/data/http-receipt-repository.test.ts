import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';
import { buildReceipt } from '@/test/factories.receipts';

import { HttpReceiptRepository } from './http-receipt-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpReceiptRepository', () => {
  test('list parses the GET /api/receipts response', async () => {
    const receipt = buildReceipt({ id: 'rc-1' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([receipt]) });

    const result = await new HttpReceiptRepository(api).list();

    expect(api.get).toHaveBeenCalledWith('/api/receipts');
    expect(result).toEqual([receipt]);
  });

  test('listByApartment parses the apartment ledger response', async () => {
    const receipt = buildReceipt({ id: 'rc-1', apartmentId: 'apt-9' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([receipt]) });

    const result = await new HttpReceiptRepository(api).listByApartment('apt-9');

    expect(api.get).toHaveBeenCalledWith('/api/apartments/apt-9/receipts');
    expect(result).toEqual([receipt]);
  });

  test('getById returns null on a 404', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(404, 'não encontrado')) });

    expect(await new HttpReceiptRepository(api).getById('nope')).toBeNull();
  });

  test('getById rethrows non-404 errors', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(500, 'boom')) });

    await expect(new HttpReceiptRepository(api).getById('x')).rejects.toBeInstanceOf(ApiError);
  });

  test('save POSTs to the pay action with the chosen method and returns the parsed receipt', async () => {
    const receipt = buildReceipt({ id: 'rc-9', status: 'pago', method: 'pix' });
    const api = fakeApi({ post: jest.fn().mockResolvedValue(receipt) });

    const result = await new HttpReceiptRepository(api).save(receipt);

    expect(api.post).toHaveBeenCalledWith('/api/receipts/rc-9/pay', { method: 'pix' });
    expect(result).toEqual(receipt);
  });
});
