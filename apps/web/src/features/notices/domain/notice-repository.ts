import type { Notice } from './notice';

export interface NoticeRepository {
  list(): Promise<Notice[]>;
  getById(id: string): Promise<Notice | null>;
  save(notice: Notice): Promise<Notice>;
  remove(id: string): Promise<void>;
}
