import { z } from 'zod';

import type { ApiClient } from '@/shared/lib/api-client';

import { noticeSchema, type Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

const noticeListSchema = z.array(noticeSchema);

export class HttpNoticeRepository implements NoticeRepository {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Notice[]> {
    return noticeListSchema.parse(await this.api.get('/api/notices'));
  }

  async getById(id: string): Promise<Notice | null> {
    const all = await this.list();
    return all.find((notice) => notice.id === id) ?? null;
  }

  async save(notice: Notice): Promise<Notice> {
    if (notice.dismissed === true) {
      return noticeSchema.parse(await this.api.post(`/api/notices/${notice.id}/dismiss`));
    }
    return noticeSchema.parse(await this.api.post('/api/notices', notice));
  }

  async remove(id: string): Promise<void> {
    await this.api.del(`/api/notices/${id}`);
  }
}
