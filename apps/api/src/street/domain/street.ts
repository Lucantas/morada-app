import { z } from 'zod';

export const pendenciesSchema = z.object({
  overdueResidents: z.number().int().nonnegative(),
  overdueAccounts: z.number().int().nonnegative(),
  accountsDueSoon: z.number().int().nonnegative(),
  proofsToReview: z.number().int().nonnegative(),
  unreadThreads: z.number().int().nonnegative(),
});

export const streetWindowSchema = z.object({
  block: z.string().nullable(),
  floor: z.number().int(),
  position: z.number().int(),
  lit: z.boolean(),
});

export const streetFactsSchema = z.object({
  pendencies: pendenciesSchema,
  windows: z.array(streetWindowSchema),
});

export type Pendencies = z.infer<typeof pendenciesSchema>;
export type StreetWindow = z.infer<typeof streetWindowSchema>;
export type StreetFacts = z.infer<typeof streetFactsSchema>;
