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
 * Item de uma compra manual. Permite informar um novo preço de venda (D5) e o
 * controle de lote/validade por produto (D6).
 */
export const manualPurchaseItemSchema = z
  .object({
    variantId: z.string().uuid('Selecione o produto'),
    quantity: positiveInt,
    unitCost: money,
    /** Novo preço de venda; se omitido, mantém o atual da variante. */
    newSalePrice: money.optional(),
    tracksLotValidity: z.boolean().default(false),
    batch: z.string().trim().min(1).optional(),
    validity: z.coerce.date().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tracksLotValidity) {
      if (!d.batch)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['batch'], message: 'Lote obrigatório' });
      if (!d.validity)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validity'], message: 'Validade obrigatória' });
    }
  });
export type ManualPurchaseItemInput = z.infer<typeof manualPurchaseItemSchema>;

/**
 * Compra manual (sem XML): dá entrada de estoque de N produtos, gera nº de
 * documento sequencial, observação e — opcionalmente — contas a pagar parceladas.
 */
export const manualPurchaseSchema = z
  .object({
    supplierId: z.string().uuid().optional(),
    supplierName: z.string().trim().min(1).optional(),
    purchaseDate: z.coerce.date(),
    notes: z.string().trim().max(500).optional(),
    items: z.array(manualPurchaseItemSchema).min(1, 'Adicione ao menos um produto'),
    /** Parcelas do contas a pagar (D7). Se vazio, não gera financeiro. */
    installments: z
      .array(z.object({ dueDate: z.coerce.date(), amount: money }))
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.supplierId && !d.supplierName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['supplierName'], message: 'Informe o fornecedor' });
    }
  });
export type ManualPurchaseInput = z.infer<typeof manualPurchaseSchema>;

/** Edição de metadados de uma compra (observação, data, nº de documento). */
export const updateInvoiceSchema = z.object({
  notes: z.string().trim().max(500).nullish(),
  purchaseDate: z.coerce.date().optional(),
  documentNumber: z.number().int().positive().nullish(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

/** Cria/atualiza manualmente um vínculo De/Para fornecedor↔variante. */
export const supplierMappingSchema = z.object({
  supplierId: z.string().uuid(),
  supplierItemCode: z.string().min(1),
  supplierBarcode: z.string().nullish(),
  variantId: z.string().uuid(),
});
export type SupplierMappingInput = z.infer<typeof supplierMappingSchema>;
