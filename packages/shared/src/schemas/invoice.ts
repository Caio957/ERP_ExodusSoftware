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
  /** Dados reais do catálogo (produto + variante) para o item já mapeado — o
   *  nome exibido ao usuário deve ser sempre o do ERP, nunca o `xProd` da nota. */
  matchedVariant: z
    .object({
      id: z.string().uuid(),
      sku: z.string(),
      description: z.string().nullable(),
      costPrice: z.number(),
      salePrice: z.number(),
      productName: z.string(),
      brand: z.string().nullable(),
      group: z.string().nullable(),
    })
    .nullable(),
  /**
   * Custo unitário já com a fatia rateada do frete/outras despesas da nota
   * embutida (landed cost) — calculado pelo backend em `/parse` a partir de
   * `freight`/`otherExpenses` do XML, para a Etapa 2 (revisão de preços) usar
   * como base de margem/markup em vez do `unitCost` bruto do documento.
   * Igual a `unitCost` quando a nota não tem frete/outras despesas.
   */
  apportionedUnitCost: z.number().nonnegative(),
});
export type ParsedNfeItem = z.infer<typeof parsedNfeItemSchema>;

export const parsedNfeSchema = z.object({
  accessKey: z.string(),
  issueDate: z.string(), // ISO
  nfeNumber: z.string(), // nNF do XML
  supplier: z.object({
    document: z.string(),
    name: z.string(),
  }),
  totalAmount: z.number().nonnegative(),
  /** vFrete/vOutro do total.ICMSTot — landed cost (4.9), ver apportionLandedCost. */
  freight: z.number().nonnegative(),
  otherExpenses: z.number().nonnegative(),
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
 * Cadastro in-line de produto durante a importação de XML (4.10): quando o
 * item não existe no catálogo, o operador preenche estes dados em vez de
 * escolher uma variante — o backend cria Produto+Variante dentro da mesma
 * transação da confirmação, antes de vincular o InvoiceItem.
 */
export const newProductDataSchema = z.object({
  name: z.string().trim().min(2, 'Nome do produto obrigatório'),
  sku: z.string().trim().min(1, 'SKU obrigatório'),
  barcode: z.string().trim().min(1).optional(),
  // Obrigatoriedade configurável (Configurações da loja) — validada na rota,
  // igual ao cadastro normal de produto (routes/products.ts).
  brand: z.string().trim().min(1).optional(),
  group: z.string().trim().min(1).optional(),
  subgroup: z.string().trim().min(1).optional(),
});
export type NewProductData = z.infer<typeof newProductDataSchema>;

/**
 * Confirmação da entrada após o usuário resolver o De/Para de cada item.
 * Ou `variantId` (produto existente já mapeado) ou `newProductData`
 * (cadastro in-line, 4.10) — nunca os dois nem nenhum dos dois. Um item novo
 * exige `newSalePrice` (não há preço "atual" para manter). Opcionalmente
 * persiste a associação fornecedor↔produto para reuso em notas futuras
 * (Requisito 4.3) — funciona também para produtos recém-criados.
 */
export const confirmInvoiceItemSchema = z
  .object({
    variantId: z.string().uuid().optional(),
    newProductData: newProductDataSchema.optional(),
    quantity: positiveInt,
    unitCost: money,
    cfop: z.string().min(1),
    /** Novo preço de venda; se omitido (produto existente), mantém o atual da variante. */
    newSalePrice: money.optional(),
    // Para gravar o De/Para:
    supplierItemCode: z.string().optional(),
    supplierBarcode: z.string().nullish(),
    saveMapping: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (!d.variantId && !d.newProductData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variantId'],
        message: 'Informe um produto existente ou os dados de um novo produto',
      });
    }
    if (d.variantId && d.newProductData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newProductData'],
        message: 'Não é possível informar produto existente e novo produto ao mesmo tempo',
      });
    }
    if (d.newProductData && !(d.newSalePrice != null && d.newSalePrice > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newSalePrice'],
        message: 'Preço de venda obrigatório para produto novo',
      });
    }
  });

export const confirmInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  accessKey: z.string().min(1, 'Chave de acesso obrigatória'),
  /** Nº da nota fiscal (nNF do XML) — exibido na listagem de compras lançadas. */
  nfeNumber: z.string().trim().optional(),
  issueDate: z.coerce.date(),
  /** Data de entrada/digitação — quando o operador deu entrada no sistema
   *  (distinta da emissão da NFe). Base do StockMovement gerado. */
  entryDate: z.coerce.date().default(() => new Date()),
  totalAmount: money,
  /** Landed cost (4.9): rateados entre os itens para compor o custo real —
   *  ver apportionLandedCost (lib/inventory.ts). O total persistido é
   *  recalculado no backend como soma dos itens + freight + otherExpenses,
   *  não o `totalAmount` acima (mantido só como referência do que veio do XML). */
  freight: money.default(0),
  otherExpenses: money.default(0),
  items: z.array(confirmInvoiceItemSchema).min(1, 'Nota sem itens'),
  /** Duplicatas do XML (mantido para compatibilidade). */
  duplicates: z
    .array(
      z.object({
        number: z.string().optional(),
        dueDate: z.coerce.date(),
        amount: money,
      }),
    )
    .default([]),
  /**
   * Parcelas definidas pelo usuário no passo 3 do fluxo de importação.
   * Se presente, substitui `duplicates` para geração das contas a pagar.
   */
  customInstallments: z
    .array(z.object({ dueDate: z.coerce.date(), amount: money }))
    .optional(),
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
    /** Landed cost (4.9): rateados entre os itens — ver apportionLandedCost. */
    freight: money.default(0),
    otherExpenses: money.default(0),
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

/**
 * Edição de uma compra. Sem `items`: edita só os metadados (observação, data,
 * nº de documento, fornecedor). Com `items`: edição completa (Mini-PDV de
 * Compras) — o backend estorna o estoque da nota antiga, recalcula o CMP dos
 * novos itens e refaz o financeiro (contas a pagar pendentes), da mesma forma
 * que a edição de vendas.
 */
export const updateInvoiceSchema = z.object({
  notes: z.string().trim().max(500).nullish(),
  purchaseDate: z.coerce.date().optional(),
  documentNumber: z.number().int().positive().nullish(),
  supplierId: z.string().uuid().optional(),
  items: z.array(manualPurchaseItemSchema).min(1, 'Adicione ao menos um produto').optional(),
  /** Landed cost (4.9). Só usado (e obrigatório considerar) quando `items`
   *  está presente — omitido, o backend trata como 0. */
  freight: money.optional(),
  otherExpenses: money.optional(),
  /** Parcelas do contas a pagar. Só usado quando `items` está presente. */
  installments: z.array(z.object({ dueDate: z.coerce.date(), amount: money })).optional(),
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
