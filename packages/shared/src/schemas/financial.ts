import { z } from 'zod';
import { money } from './common.js';
import { FinancialAccountType } from '../enums.js';

export const createFinancialAccountSchema = z.object({
  type: FinancialAccountType, // PAYABLE | RECEIVABLE
  description: z.string().trim().min(1, 'Descrição obrigatória'),
  amount: money,
  dueDate: z.coerce.date(),
  personId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});
export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;

export const payAccountSchema = z.object({
  paidAt: z.coerce.date().default(() => new Date()),
});
export type PayAccountInput = z.infer<typeof payAccountSchema>;

/** Parâmetros do endpoint analítico de sugestão de compra (Requisito 4.6). */
export const purchaseSuggestionQuerySchema = z.object({
  windowDays: z.coerce.number().int().refine((d) => [30, 60, 90].includes(d), {
    message: 'Janela deve ser 30, 60 ou 90 dias',
  }).default(30),
  leadTimeDays: z.coerce.number().int().min(1).default(15),
});
export type PurchaseSuggestionQuery = z.infer<typeof purchaseSuggestionQuerySchema>;
