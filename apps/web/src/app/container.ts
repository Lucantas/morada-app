import { InMemoryAccountRepository } from '@/features/accounts/data/in-memory-account-repository';
import { InMemoryDashboardRepository } from '@/features/dashboard/data/in-memory-dashboard-repository';
import { InMemoryThreadRepository } from '@/features/messages/data/in-memory-thread-repository';
import { InMemoryNoticeRepository } from '@/features/notices/data/in-memory-notice-repository';
import { InMemoryReceiptRepository } from '@/features/receipts/data/in-memory-receipt-repository';
import { InMemoryResidentRepository } from '@/features/residents/data/in-memory-resident-repository';

import {
  accountSeed,
  dashboardSeed,
  noticeSeed,
  receiptSeed,
  residentSeed,
  threadSeed,
} from './seed';

export const residentRepository = new InMemoryResidentRepository(residentSeed);
export const accountRepository = new InMemoryAccountRepository(accountSeed);
export const receiptRepository = new InMemoryReceiptRepository(receiptSeed);
export const dashboardRepository = new InMemoryDashboardRepository(dashboardSeed);
export const noticeRepository = new InMemoryNoticeRepository(noticeSeed);
export const threadRepository = new InMemoryThreadRepository(threadSeed);
