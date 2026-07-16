import { z } from 'zod';
import { money } from './common.js';
import { CashRegisterType, CashTransactionType } from '../enums.js';

export const openCashSchema = z.object({
  initialCash: money,
  // Default 'DIARIO' preserva o comportamento de todo caixa físico já em uso —
  // só a tela de Conta Banco (novo toggle) envia 'BANCO' explicitamente.
  type: CashRegisterType.default('DIARIO'),
});
export type OpenCashInput = z.infer<typeof openCashSchema>;

/** Filtro por tipo de caixa nas rotas de listagem/histórico/relatório. */
export const cashRegisterTypeQuerySchema = z.object({
  type: CashRegisterType.default('DIARIO'),
});
export type CashRegisterTypeQuery = z.infer<typeof cashRegisterTypeQuerySchema>;

export const closeCashSchema = z.object({
  /** Valor contado na gaveta no fechamento (para conferência de diferença). */
  finalCash: money,
});
export type CloseCashInput = z.infer<typeof closeCashSchema>;

export const cashTransactionSchema = z.object({
  type: CashTransactionType, // SUPPLY (suprimento) | BLEED (sangria)
  amount: money.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  description: z.string().trim().min(1, 'Descrição/observação obrigatória'),
});
export type CashTransactionInput = z.infer<typeof cashTransactionSchema>;

/** Edição de uma sangria/suprimento manual (não toca lançamentos de origem). */
export const updateCashTransactionSchema = cashTransactionSchema.partial();
export type UpdateCashTransactionInput = z.infer<typeof updateCashTransactionSchema>;
