import { z } from 'zod';

export const proofSchema = z
  .string()
  .regex(/^data:(image\/[a-z0-9.+-]+|application\/pdf);base64,/i, 'Comprovante inválido')
  .max(7_000_000);
