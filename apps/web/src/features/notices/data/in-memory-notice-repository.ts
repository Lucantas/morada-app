import type { Notice } from '../domain/notice';
import type { NoticeRepository } from '../domain/notice-repository';

import { toNotice } from './notice-row';

export class InMemoryNoticeRepository implements NoticeRepository {
  private notices: Map<string, Notice>;

  constructor(seed: readonly unknown[] = []) {
    this.notices = new Map(seed.map((raw) => toNotice(raw)).map((n) => [n.id, n]));
  }

  async list(): Promise<Notice[]> {
    return [...this.notices.values()];
  }

  async getById(id: string): Promise<Notice | null> {
    return this.notices.get(id) ?? null;
  }

  async save(notice: Notice): Promise<Notice> {
    this.notices = new Map(this.notices).set(notice.id, notice);
    return notice;
  }

  async remove(id: string): Promise<void> {
    const next = new Map(this.notices);
    next.delete(id);
    this.notices = next;
  }
}
