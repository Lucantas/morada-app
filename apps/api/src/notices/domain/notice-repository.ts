import type { Notice } from './notice';

export interface NoticeRepository {
  list(viewerResidentId: string | null): Promise<Notice[]>;
  getById(id: string): Promise<Notice | null>;
  save(notice: Notice): Promise<Notice>;
  dismiss(noticeId: string, residentId: string): Promise<Notice>;
  remove(id: string): Promise<void>;
}
