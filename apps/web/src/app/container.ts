import { InMemoryAccountRepository } from '@/features/accounts/data/in-memory-account-repository';
import { InMemoryDashboardRepository } from '@/features/dashboard/data/in-memory-dashboard-repository';
import { InMemoryReceiptRepository } from '@/features/receipts/data/in-memory-receipt-repository';
import { InMemoryResidentRepository } from '@/features/residents/data/in-memory-resident-repository';

import { accountSeed, dashboardSeed, receiptSeed, residentSeed } from './seed';

export const residentRepository = new InMemoryResidentRepository(residentSeed);
export const accountRepository = new InMemoryAccountRepository(accountSeed);
export const receiptRepository = new InMemoryReceiptRepository(receiptSeed);
export const dashboardRepository = new InMemoryDashboardRepository(dashboardSeed);
