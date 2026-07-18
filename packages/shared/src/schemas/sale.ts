import { z } from 'zod';
import { money, positiveInt } from './common.js';
import { CashRegisterType } from '../enums.js';

/**
 * Código da forma de pagamento. Aceita qualquer tipo configurado nas
 * Configurações (tipos de recebimento), além dos base. O backend trata
 * 'A_PRAZO' (gera parcelas) e 'CASH' (entra no caixa) de forma especial.
 */
const paymentCode = z.string().trim().min(1, 'Forma de pagamento obrigatória').max(20);

export const saleItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: positiveInt,
  unitPrice: money,
});
export type SaleItemInput = z.infer<typeof saleItemSchema>;

/** Uma forma de pagamento da venda (split permite várias). */
export const salePaymentSchema = z.object({
  method: paymentCode,
  amount: money.refine((v) => v > 0, 'Valor do pagamento deve ser maior que zero'),
});
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;

/** Parcela de uma venda "A prazo" (contas a receber). */
export const saleInstallmentSchema = z.object({
  dueDate: z.coerce.date(),
  amount: money.refine((v) => v > 0, 'Valor da parcela deve ser maior que zero'),
});
export type SaleInstallmentInput = z.infer<typeof saleInstallmentSchema>;

export const createSaleSchema = z.object({
  cashRegisterId: z.string().uuid(),
  paymentMethod: paymentCode,
  clientId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1, 'Venda sem itens'),
  /** Desconto e acréscimo aplicados sobre o subtotal (valores em R$). */
  discount: money.default(0),
  surcharge: money.default(0),
  /** Observação livre da venda. */
  notes: z.string().trim().max(500).optional(),
  /**
   * Formas de pagamento. Quando omitido, assume pagamento único pelo
   * `paymentMethod` no valor total. Permite split (várias formas).
   */
  payments: z.array(salePaymentSchema).optional(),
  /**
   * Parcelas da parte "A prazo" (gera contas a receber). Obrigatório quando
   * houver pagamento com método `A_PRAZO`; exige também `clientId`.
   */
  installments: z.array(saleInstallmentSchema).optional(),
  /**
   * Identificador gerado no cliente (PDV offline). Usado como chave de
   * idempotência: ao sincronizar a fila do Dexie, evita registrar a mesma
   * venda duas vezes se o ACK se perder (Requisito 4.4).
   */
  clientRef: z.string().uuid().optional(),
  /** Momento real da venda no dispositivo (pode diferir do recebimento). */
  soldAt: z.coerce.date().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

/** Lote de vendas enviado pela fila offline ao restabelecer a rede. */
export const syncSalesSchema = z.object({
  sales: z.array(createSaleSchema).min(1),
});
export type SyncSalesInput = z.infer<typeof syncSalesSchema>;

/**
 * Edição "por completo" de uma venda já registrada (PDV-C). Substitui itens,
 * valores e forma de pagamento. O backend estorna o estoque anterior, remove o
 * financeiro vinculado e regrava tudo de forma consistente. Aceita split e
 * "A prazo" (parcelas → contas a receber), assim como a criação da venda.
 */
export const updateSaleSchema = z.object({
  paymentMethod: paymentCode,
  clientId: z.string().uuid().nullish(),
  items: z.array(saleItemSchema).min(1, 'Venda sem itens'),
  discount: money.default(0),
  surcharge: money.default(0),
  notes: z.string().trim().max(500).nullish(),
  /** Formas de pagamento (split). Omitido = pagamento único pelo paymentMethod. */
  payments: z.array(salePaymentSchema).optional(),
  /** Parcelas da parte "A prazo" (contas a receber). Exige clientId. */
  installments: z.array(saleInstallmentSchema).optional(),
  /**
   * Caixa de destino do financeiro recriado pela edição (DIARIO/BANCO).
   * Opcional: quando informado, move a venda para o caixa aberto do usuário
   * logado daquele tipo antes de regravar o financeiro (mesmo mecanismo de
   * `regenerateSaleFinancialSchema`, usado aqui pelo Mini-PDV de edição).
   */
  targetRegisterType: CashRegisterType.optional(),
});
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

/**
 * Regeração do financeiro de uma venda (`POST /api/sales/:id/financial`).
 * `targetRegisterType` é opcional: quando informado, move a venda para o
 * caixa aberto do operador daquele tipo (DIARIO/BANCO) antes de reativar o
 * financeiro — usado quando o operador tem mais de um caixa aberto e quer
 * escolher em qual "livro" a venda volta a contar.
 */
export const regenerateSaleFinancialSchema = z.object({
  targetRegisterType: CashRegisterType.optional(),
});
export type RegenerateSaleFinancialInput = z.infer<typeof regenerateSaleFinancialSchema>;
