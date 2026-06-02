import { z } from 'zod';
import { money } from './common.js';
import { CashTransactionType } from '../enums.js';

export const openCashSchema = z.object({
  initialCash: money,
});
export type OpenCashInput = z.infer<typeof openCashSchema>;

export const closeCashSchema = z.object({
  /** Valor contado na gaveta no fechamento (para conferência de diferença). */
  finalCash: money,
});
export type CloseCashInput = z.infer<typeof closeCashSchema>;

export const cashTransactionSchema = z.object({
  type: CashTransactionType, // SUPPLY (suprimento) | BLEED (sangria)
  amount: money.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  description: z.string().trim().min(1, 'Descrição obrigatória'),
});
export type CashTransactionInput = z.infer<typeof cashTransactionSchema>;
