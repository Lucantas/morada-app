import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';
import { ApiError } from '@/shared/lib/api-client';

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

  async save(thread: Thread): Promise<Thread> {
    const current = await this.getById(thread.id);
    const currentLen = current?.messages.length ?? 0;

    if (thread.messages.length > currentLen) {
      const last = thread.messages[thread.messages.length - 1];
      if (!last) return thread;
      return threadSchema.parse(
        await this.api.post(`/api/threads/${thread.id}/messages`, { text: last.text }),
      );
    }

    return threadSchema.parse(await this.api.post(`/api/threads/${thread.id}/read`));
  }
}
