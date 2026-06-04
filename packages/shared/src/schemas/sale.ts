import { z } from 'zod';
import { money, positiveInt } from './common.js';
import { PaymentMethod } from '../enums.js';

export const saleItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: positiveInt,
  unitPrice: money,
});
export type SaleItemInput = z.infer<typeof saleItemSchema>;

export const createSaleSchema = z.object({
  cashRegisterId: z.string().uuid(),
  paymentMethod: PaymentMethod,
  clientId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1, 'Venda sem itens'),
  /** Desconto e acréscimo aplicados sobre o subtotal (valores em R$). */
  discount: money.default(0),
  surcharge: money.default(0),
  /** Observação livre da venda. */
  notes: z.string().trim().max(500).optional(),
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
