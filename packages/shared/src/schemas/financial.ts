import { z } from 'zod';
import { money, paginationQuery } from './common.js';
import { FinancialAccountType, FinancialAccountStatus, CashRegisterType } from '../enums.js';

export const createFinancialAccountSchema = z.object({
  type: FinancialAccountType, // PAYABLE | RECEIVABLE
  description: z.string().trim().min(1, 'Descrição obrigatória'),
  amount: money,
  dueDate: z.coerce.date(),
  personId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});
export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;

/**
 * Baixa (liquidação) de um título — permite baixa parcial (E1).
 *  - `amount` omitido baixa o saldo restante (quitação total).
 *  - `settleInFull` quita o título mesmo quando o valor pago é menor que o
 *    saldo (ex.: desconto concedido na negociação).
 *  - `targetRegisterType` (DIARIO/BANCO) é obrigatório: define em qual caixa
 *    aberto do usuário logado a `CashTransaction` de compensação é lançada —
 *    substitui o antigo lookup implícito (primeiro caixa aberto encontrado),
 *    ambíguo desde que passou a ser possível ter os dois tipos abertos ao
 *    mesmo tempo.
 */
export const settleAccountSchema = z.object({
  amount: money.optional(),
  settleInFull: z.boolean().default(false),
  paidAt: z.coerce.date().default(() => new Date()),
  targetRegisterType: CashRegisterType,
});
export type SettleAccountInput = z.infer<typeof settleAccountSchema>;

/**
 * Lançamento manual com geração de parcelas. O valor total é dividido em N
 * parcelas (a última absorve o arredondamento) com vencimentos espaçados por
 * `intervalDays` a partir do primeiro vencimento.
 */
export const createInstallmentsSchema = z.object({
  type: FinancialAccountType, // PAYABLE | RECEIVABLE
  description: z.string().trim().min(1, 'Descrição obrigatória'),
  totalAmount: money.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  firstDueDate: z.coerce.date(),
  installments: z.coerce.number().int().min(1).max(60).default(1),
  intervalDays: z.coerce.number().int().min(1).max(365).default(30),
  // Fornecedor (a pagar) ou cliente (a receber) — obrigatório (E5/E6).
  personId: z.string().uuid('Informe o fornecedor/cliente'),
});
export type CreateInstallmentsInput = z.infer<typeof createInstallmentsSchema>;

/** Edição de um título manual (não permitida para títulos de origem nota/venda). */
export const updateFinancialAccountSchema = z.object({
  description: z.string().trim().min(1).optional(),
  amount: money.optional(),
  dueDate: z.coerce.date().optional(),
  personId: z.string().uuid().nullish(),
});
export type UpdateFinancialAccountInput = z.infer<typeof updateFinancialAccountSchema>;

/**
 * Listagem de contas a pagar/receber com filtros e ordenação avançada.
 *  - `status`: filtro exato pelo enum de status (compatibilidade).
 *  - `statusFilter`: filtro semântico usado pela tela (Abertos/Vencidos/A Vencer/
 *    Quitados parcialmente/Quitados) — quando presente, tem precedência sobre
 *    `status`/`dueFrom`/`dueTo` no cálculo do `where` (rota `GET /financial`).
 */
export const listFinancialQuerySchema = paginationQuery.extend({
  type: FinancialAccountType.optional(),
  status: FinancialAccountStatus.optional(),
  personId: z.string().uuid().optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  orderBy: z.enum(['code', 'description', 'dueDate', 'amount']).default('dueDate'),
  orderDir: z.enum(['asc', 'desc']).default('asc'),
  statusFilter: z.enum(['ALL', 'OPEN', 'OVERDUE', 'NOT_OVERDUE', 'PARTIAL', 'PAID']).default('ALL'),
});
export type ListFinancialQuery = z.infer<typeof listFinancialQuerySchema>;

/** Parâmetros do endpoint analítico de sugestão de compra (Requisito 4.6). */
export const purchaseSuggestionQuerySchema = z.object({
  windowDays: z.coerce.number().int().refine((d) => [30, 60, 90].includes(d), {
    message: 'Janela deve ser 30, 60 ou 90 dias',
  }).default(30),
  leadTimeDays: z.coerce.number().int().min(1).default(15),
  brand: z.string().trim().optional(),
  group: z.string().trim().optional(),
  subgroup: z.string().trim().optional(),
});
export type PurchaseSuggestionQuery = z.infer<typeof purchaseSuggestionQuerySchema>;
