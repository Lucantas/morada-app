import type { ActivityAction } from '../../domain/activity';

import { resolverFromTable } from './record-activity';

const BASE = '/api/condos/:condoId';

export const ACTIVITY_TABLE: Readonly<Record<string, ActivityAction>> = {
  [`POST ${BASE}/accounts`]: 'account.created',
  [`PUT ${BASE}/accounts/:id`]: 'account.updated',
  [`DELETE ${BASE}/accounts/:id`]: 'account.archived',
  [`POST ${BASE}/incomes`]: 'income.created',
  [`PUT ${BASE}/incomes/:id`]: 'income.updated',
  [`DELETE ${BASE}/incomes/:id`]: 'income.archived',
  [`PUT ${BASE}/categories`]: 'categories.saved',
  [`POST ${BASE}/receipts`]: 'receipt.created',
  [`PUT ${BASE}/receipts/:id`]: 'receipt.updated',
  [`DELETE ${BASE}/receipts/:id`]: 'receipt.archived',
  [`POST ${BASE}/receipts/:id/confirm`]: 'receipt.confirmed',
  [`POST ${BASE}/receipts/:id/reject`]: 'receipt.rejected',
  [`POST ${BASE}/receipts/ensure-month`]: 'receipt.monthly',
  [`POST ${BASE}/receipts/:id/pay`]: 'receipt.paid',
  [`POST ${BASE}/receipts/:id/submit-payment`]: 'receipt.submitted',
  [`PUT ${BASE}/residents/:id/status`]: 'resident.status',
  [`POST ${BASE}/building/apartments`]: 'apartment.added',
  [`PUT ${BASE}/building/apartments/:id`]: 'apartment.renamed',
  [`POST ${BASE}/building/apartments/:id/deactivate`]: 'apartment.deactivated',
  [`PUT ${BASE}/settings`]: 'settings.saved',
  [`PUT ${BASE}/info`]: 'condo.renamed',
};

export const activityResolver = resolverFromTable(ACTIVITY_TABLE);
