import { z } from 'zod';

export const pixInfoSchema = z.discriminatedUnion('configured', [
  z.object({ configured: z.literal(false) }),
  z.object({
    configured: z.literal(true),
    key: z.string().min(1),
    receiverName: z.string().min(1),
    city: z.string().min(1),
  }),
]);
export type PixInfo = z.infer<typeof pixInfoSchema>;
