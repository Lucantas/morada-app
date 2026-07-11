import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'resident']);
export type Role = z.infer<typeof roleSchema>;
