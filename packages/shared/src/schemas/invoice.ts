import { z } from 'zod';
import { money, positiveInt } from './common.js';

/** Entrada bruta: o XML da NFe enviado pelo frontend para parsing no backend. */
export const parseNfeSchema = z.object({
  xml: z.string().min(1, 'XML obrigatório'),
});
export type ParseNfeInput = z.infer<typeof parseNfeSchema>;

/** Item já normalizado a partir do XML (antes do De/Para). */
export const parsedNfeItemSchema = z.object({
  supplierItemCode: z.string(), // cProd
  supplierBarcode: z.string().nullable(), // cEAN
  description: z.string(), // xProd
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  cfop: z.string(), // registrado como veio (flexível) - Requisito 4.3
  /** Resolvido pelo backend via SupplierProductMapping, se já existir. */
  matchedVariantId: z.string().uuid().nullable(),
});
export type ParsedNfeItem = z.infer<typeof parsedNfeItemSchema>;

export const parsedNfeSchema = z.object({
  accessKey: z.string(),
  issueDate: z.string(), // ISO
  supplier: z.object({
    document: z.string(),
    name: z.string(),
  }),
  totalAmount: z.number().nonnegative(),
  items: z.array(parsedNfeItemSchema),
  duplicates: z.array(
    z.object({
      number: z.string(),
      dueDate: z.string(), // ISO
      amount: z.number().nonnegative(),
    }),
  ),
});
export type ParsedNfe = z.infer<typeof parsedNfeSchema>;

/**
 * Confirmação da entrada após o usuário resolver o De/Para de cada item.
 * `variantId` já mapeado; opcionalmente persiste a associação fornecedor↔produto
 * para reuso em notas futuras (Requisito 4.3).
 */
export const confirmInvoiceItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: positiveInt,
  unitCost: money,
  cfop: z.string().min(1),
  // Para gravar o De/Para:
  supplierItemCode: z.string().optional(),
  supplierBarcode: z.string().nullish(),
  saveMapping: z.boolean().default(true),
});

export const confirmInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  accessKey: z.string().min(1, 'Chave de acesso obrigatória'),
  issueDate: z.coerce.date(),
  totalAmount: money,
  items: z.array(confirmInvoiceItemSchema).min(1, 'Nota sem itens'),
  duplicates: z
    .array(
      z.object({
        number: z.string().optional(),
        dueDate: z.coerce.date(),
        amount: money,
      }),
    )
    .default([]),
});
export type ConfirmInvoiceInput = z.infer<typeof confirmInvoiceSchema>;

/**
 * Compra manual (sem XML): dá entrada de estoque de uma variante existente,
 * informando fornecedor (existente ou novo), data, quantidade, custo e —
 * opcionalmente — controle de lote/validade.
 */
export const manualPurchaseSchema = z
  .object({
    supplierId: z.string().uuid().optional(),
    supplierName: z.string().trim().min(1).optional(),
    purchaseDate: z.coerce.date(),
    variantId: z.string().uuid('Selecione o produto'),
    quantity: positiveInt,
    unitCost: money,
    tracksLotValidity: z.boolean().default(false),
    batch: z.string().trim().min(1).optional(),
    validity: z.coerce.date().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.supplierId && !d.supplierName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['supplierName'],
        message: 'Informe o fornecedor',
      });
    }
    if (d.tracksLotValidity) {
      if (!d.batch)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['batch'], message: 'Lote obrigatório' });
      if (!d.validity)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validity'],
          message: 'Validade obrigatória',
        });
    }
  });
export type ManualPurchaseInput = z.infer<typeof manualPurchaseSchema>;

/** Cria/atualiza manualmente um vínculo De/Para fornecedor↔variante. */
export const supplierMappingSchema = z.object({
  supplierId: z.string().uuid(),
  supplierItemCode: z.string().min(1),
  supplierBarcode: z.string().nullish(),
  variantId: z.string().uuid(),
});
export type SupplierMappingInput = z.infer<typeof supplierMappingSchema>;
