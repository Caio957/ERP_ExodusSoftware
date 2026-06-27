import { z } from 'zod';
import { money, paginationQuery } from './common.js';

/** Querystring da listagem de produtos: paginação + filtros + ordenação. */
export const listProductsQuerySchema = paginationQuery.extend({
  brand: z.string().trim().min(1).optional(),
  group: z.string().trim().min(1).optional(),
  subgroup: z.string().trim().min(1).optional(),
  orderBy: z.enum(['code', 'sku', 'name', 'price']).default('name'),
  orderDir: z.enum(['asc', 'desc']).default('asc'),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

/**
 * Variante de produto. Lote (batch) e validade são OPCIONAIS por padrão; a
 * obrigatoriedade depende do produto ter `tracksLotValidity` ligado (4.1),
 * validada no nível do produto (superRefine de createProductSchema).
 */
export const createVariantSchema = z
  .object({
    sku: z.string().trim().min(1, 'SKU obrigatório'),
    barcode: z.string().trim().min(1).optional(),
    // Descrição da variante é opcional (o backend usa o nome do produto como
    // fallback quando vazia).
    description: z.string().trim().min(1).optional(),
    costPrice: money,
    averageCost: money.default(0),
    salePrice: money,
    stockQty: z.number().int().min(0).default(0),
    batch: z.string().trim().min(1).optional(),
    validity: z.coerce.date({ invalid_type_error: 'Validade inválida' }).optional(),
  })
  .refine((v) => v.salePrice >= v.costPrice, {
    message: 'Preço de venda não pode ser menor que o custo',
    path: ['salePrice'],
  });
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome do produto obrigatório'),
    // Marca/grupo/subgrupo: obrigatoriedade é configurável por loja
    // (validada na rota conforme as Configurações). Aqui ficam opcionais.
    brand: z.string().trim().min(1).optional(),
    group: z.string().trim().min(1).optional(),
    subgroup: z.string().trim().min(1).optional(),
    /** Liga a obrigatoriedade de lote e validade nas variantes (4.1). */
    tracksLotValidity: z.boolean().default(false),
    variants: z.array(createVariantSchema).min(1, 'Informe ao menos uma variante'),
  })
  .superRefine((data, ctx) => {
    if (!data.tracksLotValidity) return;
    data.variants.forEach((v, i) => {
      if (!v.batch) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', i, 'batch'],
          message: 'Lote obrigatório quando há controle de lote/validade',
        });
      }
      if (!v.validity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['variants', i, 'validity'],
          message: 'Validade obrigatória quando há controle de lote/validade',
        });
      }
    });
  });
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).optional(),
  brand: z.string().trim().min(1).optional(),
  group: z.string().trim().min(1).optional(),
  subgroup: z.string().trim().min(1).nullish(),
  tracksLotValidity: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Acerto de estoque (inventário): informa a quantidade física contada e o
 * motivo. O backend registra a diferença como StockMovement do tipo ADJUST.
 */
export const stockAdjustSchema = z.object({
  variantId: z.string().uuid('Selecione o produto'),
  newQuantity: z.number().int().min(0, 'Quantidade não pode ser negativa'),
  reason: z.string().trim().min(1, 'Informe o motivo do acerto').max(200),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

/** Atualização avulsa de uma variante (preço, estoque manual, lote, validade). */
export const updateVariantSchema = z.object({
  sku: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  barcode: z.string().trim().min(1).nullish(),
  costPrice: money.optional(),
  averageCost: money.optional(),
  salePrice: money.optional(),
  batch: z.string().trim().min(1).optional(),
  validity: z.coerce.date().optional(),
});
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
