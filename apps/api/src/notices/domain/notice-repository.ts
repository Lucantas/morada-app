import type { Notice } from './notice';

export interface NoticeRepository {
  list(): Notice[];
  getById(id: string): Notice | null;
  save(notice: Notice): Notice;
  remove(id: string): void;
}
