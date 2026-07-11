import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';
import { buildMessage, buildThread } from '@/test/factories.messages';

import { HttpThreadRepository } from './http-thread-repository';

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    ...overrides,
  };
}

describe('HttpThreadRepository', () => {
  test('list parses the GET /api/threads response', async () => {
    const thread = buildThread({ id: 't-1' });
    const api = fakeApi({ get: jest.fn().mockResolvedValue([thread]) });

    const result = await new HttpThreadRepository(api).list();

    expect(api.get).toHaveBeenCalledWith('/api/threads');
    expect(result).toEqual([thread]);
  });

  test('getById returns null on a 404', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(404, 'não encontrado')) });

    expect(await new HttpThreadRepository(api).getById('nope')).toBeNull();
  });

  test('getById rethrows non-404 errors', async () => {
    const api = fakeApi({ get: jest.fn().mockRejectedValue(new ApiError(500, 'boom')) });

    await expect(new HttpThreadRepository(api).getById('x')).rejects.toBeInstanceOf(ApiError);
  });

  test('save POSTs to the messages path when a message was appended', async () => {
    const serverThread = buildThread({ id: 't-9', messages: [buildMessage()] });
    const newMessage = buildMessage({ text: 'Bom dia!' });
    const draftThread = buildThread({
      id: 't-9',
      messages: [...serverThread.messages, newMessage],
    });
    const updatedThread = buildThread({ id: 't-9', messages: draftThread.messages });
    const api = fakeApi({
      get: jest.fn().mockResolvedValue(serverThread),
      post: jest.fn().mockResolvedValue(updatedThread),
    });

    const result = await new HttpThreadRepository(api).save(draftThread);

    expect(api.get).toHaveBeenCalledWith('/api/threads/t-9');
    expect(api.post).toHaveBeenCalledWith('/api/threads/t-9/messages', { text: 'Bom dia!' });
    expect(result).toEqual(updatedThread);
  });

  test('save POSTs to the read path when no message was appended', async () => {
    const messages = [buildMessage(), buildMessage()];
    const serverThread = buildThread({ id: 't-5', messages, unread: true });
    const draftThread = buildThread({ id: 't-5', messages, unread: false });
    const updatedThread = buildThread({ id: 't-5', messages, unread: false });
    const api = fakeApi({
      get: jest.fn().mockResolvedValue(serverThread),
      post: jest.fn().mockResolvedValue(updatedThread),
    });

    const result = await new HttpThreadRepository(api).save(draftThread);

    expect(api.get).toHaveBeenCalledWith('/api/threads/t-5');
    expect(api.post).toHaveBeenCalledWith('/api/threads/t-5/read');
    expect(result).toEqual(updatedThread);
  });
});
