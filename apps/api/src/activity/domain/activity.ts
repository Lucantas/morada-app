import { z } from 'zod';

export const ACTIVITY_LABELS = {
  'account.created': 'Conta lançada',
  'account.updated': 'Conta atualizada',
  'account.archived': 'Conta arquivada',
  'income.created': 'Receita lançada',
  'income.updated': 'Receita atualizada',
  'income.archived': 'Receita arquivada',
  'categories.saved': 'Categorias salvas',
  'receipt.created': 'Cobrança criada',
  'receipt.updated': 'Cobrança editada',
  'receipt.archived': 'Cobrança arquivada',
  'receipt.confirmed': 'Pagamento conferido',
  'receipt.rejected': 'Pagamento recusado',
  'receipt.monthly': 'Cobranças do mês geradas',
  'receipt.paid': 'Pagamento registrado',
  'receipt.submitted': 'Comprovante enviado',
  'resident.status': 'Situação do morador alterada',
  'apartment.added': 'Apartamento adicionado',
  'apartment.renamed': 'Apartamento renomeado',
  'apartment.deactivated': 'Apartamento desativado',
  'settings.saved': 'Ajustes do condomínio salvos',
  'condo.renamed': 'Condomínio renomeado',
} as const;

export type ActivityAction = keyof typeof ACTIVITY_LABELS;

export const activityActionSchema = z.enum(
  Object.keys(ACTIVITY_LABELS) as [ActivityAction, ...ActivityAction[]],
);

export const activityEntrySchema = z.object({
  id: z.string().min(1),
  action: activityActionSchema,
  actorName: z.string(),
  subjectId: z.string().nullable(),
  at: z.date(),
});

export type ActivityEntry = z.infer<typeof activityEntrySchema>;

export interface ActivityRecord {
  actorUserId: string;
  action: ActivityAction;
  subjectId: string | null;
  at: Date;
}
