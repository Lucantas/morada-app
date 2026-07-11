import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

import type { MessageAuthor } from '../domain/message';
import { threadSchema, type Thread } from '../domain/message';
import type { ThreadRepository } from '../domain/thread-repository';

const threadListSchema = z.array(threadSchema);

export class HttpThreadRepository implements ThreadRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Thread[]> {
    return threadListSchema.parse(await this.api.get('/api/threads'));
  }

  async getById(id: string): Promise<Thread | null> {
    try {
      return threadSchema.parse(await this.api.get(`/api/threads/${id}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  // The API derives the author from the caller's JWT role, so `author` is part
  // of the domain contract but intentionally not sent over the wire.
  async addMessage(threadId: string, _author: MessageAuthor, text: string): Promise<Thread> {
    return threadSchema.parse(await this.api.post(`/api/threads/${threadId}/messages`, { text }));
  }

  async markRead(threadId: string): Promise<Thread> {
    return threadSchema.parse(await this.api.post(`/api/threads/${threadId}/read`));
  }
}
