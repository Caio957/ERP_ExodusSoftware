import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  parseNfeSchema,
  confirmInvoiceSchema,
  supplierMappingSchema,
  manualPurchaseSchema,
  updateInvoiceSchema,
  paginationQuery,
  apportionLandedCost,
  productFormSettingsSchema,
} from '@exodus/shared';
import { serializeDecimals } from '../lib/serialize.js';
import { parseNfeXml } from '../services/nfe-parser.js';
import { BusinessError, ConflictError, NotFoundError } from '../lib/errors.js';
import { calcWeightedAverageCost } from '../lib/inventory.js';
import { getSetting } from '../lib/settings.js';
import { tenantDb } from '../lib/tenant.js';

const idParam = z.object({ id: z.string().uuid() });

export async function invoiceRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /api/invoices/parse
   * Recebe o XML, normaliza e tenta resolver o De/Para de cada item:
   *  1) mapeamento salvo do fornecedor (cProd) ; 2) código de barras (cEAN).
   * Itens não resolvidos voltam com matchedVariantId=null para o usuário
   * associar na modal (Requisito 4.3).
   */
  r.post('/parse', { preHandler: app.authenticate, schema: { body: parseNfeSchema } }, async (req) => {
    const { db } = tenantDb(req);
    const raw = parseNfeXml(req.body.xml);

    // `document`/`accessKey`/`barcode` continuam @unique GLOBAIS no schema
    // (decisão da Fase 1, ainda não revisitada — ver cabeçalho de
    // schema.prisma), mas as buscas aqui são escopadas por tenant: um
    // fornecedor/produto/nota cadastrado por OUTRA empresa não pode ser
    // enxergado como "já existe" por esta.
    const supplier = raw.supplier.document
      ? await db.person.findFirst({ where: { document: raw.supplier.document } })
      : null;

    const codes = raw.items.map((i) => i.supplierItemCode);
    const barcodes = raw.items.map((i) => i.supplierBarcode).filter((b): b is string => !!b);

    const [mappings, variantsByBarcode] = await Promise.all([
      supplier
        ? db.supplierProductMapping.findMany({
            where: { supplierId: supplier.id, supplierItemCode: { in: codes } },
          })
        : Promise.resolve([]),
      barcodes.length
        ? db.productVariant.findMany({ where: { barcode: { in: barcodes } } })
        : Promise.resolve([]),
    ]);

    const mapByCode = new Map(mappings.map((m) => [m.supplierItemCode, m.variantId]));
    const mapByBarcode = new Map(variantsByBarcode.map((v) => [v.barcode!, v.id]));

    const matchedVariantIds = raw.items.map((item) => ({
      supplierItemCode: item.supplierItemCode,
      matchedVariantId:
        mapByCode.get(item.supplierItemCode) ??
        (item.supplierBarcode ? mapByBarcode.get(item.supplierBarcode) : undefined) ??
        null,
    }));

    // Resolve o catálogo real (nome do produto + variante) para os itens já
    // mapeados automaticamente — a caixa verde do De/Para deve exibir o nome
    // cadastrado no ERP, nunca o `xProd` que veio na nota do fornecedor.
    const uniqueMatchedIds = [
      ...new Set(matchedVariantIds.map((m) => m.matchedVariantId).filter((id): id is string => !!id)),
    ];
    const matchedVariants = uniqueMatchedIds.length
      ? await db.productVariant.findMany({
          where: { id: { in: uniqueMatchedIds } },
          include: { product: { select: { name: true, brand: true, group: true } } },
        })
      : [];
    const variantDetailById = new Map(
      matchedVariants.map((v) => [
        v.id,
        {
          id: v.id,
          sku: v.sku,
          description: v.description,
          costPrice: Number(v.costPrice),
          salePrice: Number(v.salePrice),
          productName: v.product.name,
          brand: v.product.brand,
          group: v.product.group,
        },
      ]),
    );

    // Frete/outras despesas (4.9) vêm só como referência inicial — o
    // operador pode editá-los na Etapa 1 (4.11), então o rateio em si
    // (apportionLandedCost) é recalculado no cliente a partir do estado
    // editável, não fixado aqui a partir do vFrete/vOutro originais do XML.
    const items = raw.items.map((item, i) => ({
      ...item,
      matchedVariantId: matchedVariantIds[i]!.matchedVariantId,
      matchedVariant: matchedVariantIds[i]!.matchedVariantId
        ? (variantDetailById.get(matchedVariantIds[i]!.matchedVariantId!) ?? null)
        : null,
    }));

    return {
      accessKey: raw.accessKey,
      issueDate: raw.issueDate,
      nfeNumber: raw.nfeNumber,
      supplier: { ...raw.supplier, existingId: supplier?.id ?? null },
      totalAmount: raw.totalAmount,
      freight: raw.freight,
      otherExpenses: raw.otherExpenses,
      items,
      duplicates: raw.duplicates,
      alreadyImported: raw.accessKey
        ? !!(await db.invoice.findFirst({ where: { accessKey: raw.accessKey } }))
        : false,
    };
  });

  /**
   * POST /api/invoices/confirm
   * Após o De/Para resolvido: cria a nota, dá entrada no estoque (StockMovement),
   * salva os mapeamentos novos e alimenta Contas a Pagar com as duplicatas.
   */
  r.post(
    '/confirm',
    { preHandler: app.authenticate, schema: { body: confirmInvoiceSchema } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const { supplierId, accessKey, nfeNumber, issueDate, entryDate, freight, otherExpenses, items, duplicates, customInstallments } = req.body;

      const exists = await db.invoice.findFirst({ where: { accessKey } });
      if (exists) throw new ConflictError('Nota fiscal já importada', { accessKey });

      // Landed cost (4.9): custo unitário rateado (embute a fatia de
      // frete/outras despesas) — usado para atualizar costPrice/averageCost
      // do produto. InvoiceItem.unitCost continua guardando o valor bruto do
      // documento. totalAmount persistido = soma dos itens + despesas extras
      // (não o vNF vindo do XML — fonte única com /manual e a edição).
      const productsTotal = items.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);
      const apportioned = apportionLandedCost(items, freight, otherExpenses);
      const totalAmount = Math.round((productsTotal + freight + otherExpenses) * 100) / 100;

      const invoice = await db.$transaction(async (tx) => {
        // Nº de documento sequencial (mesma lógica de /manual — D4). Escopado
        // por tenant: cada empresa tem sua própria sequência de documentos.
        const last = await tx.invoice.aggregate({ _max: { documentNumber: true } });
        const documentNumber = (last._max.documentNumber ?? 0) + 1;

        // Cadastro in-line de produto (4.10): resolve o variantId de cada
        // item ANTES de gravar a nota — itens com `newProductData` criam
        // Produto+Variante aqui, na mesma transação, para que uma falha em
        // qualquer ponto (ex.: item seguinte) desfaça tanto a nota quanto os
        // produtos já criados (nunca fica "produto pela metade"). Itens com
        // `variantId` vindo do cliente são validados aqui via findFirst
        // escopado — se pertencerem a outro tenant, a busca falha e a
        // transação inteira é abortada (fecha um IDOR real que existia
        // antes de o multi-tenant entrar em vigor).
        let productFormCfg: ReturnType<typeof productFormSettingsSchema.parse> | null = null;
        const resolvedItems = await Promise.all(
          items.map(async (it, i) => {
            if (it.variantId) {
              const owned = await tx.productVariant.findFirst({ where: { id: it.variantId } });
              if (!owned) throw new NotFoundError('Produto');
              return { ...it, resolvedVariantId: owned.id };
            }

            const draft = it.newProductData!;
            if (!productFormCfg) {
              const setting = await getSetting(companyId, 'product_form', tx);
              productFormCfg = productFormSettingsSchema.parse(setting?.value ?? {});
            }
            if (productFormCfg.brandRequired && !draft.brand)
              throw new BusinessError(`Marca é obrigatória (produto novo "${draft.name}")`);
            if (productFormCfg.groupRequired && !draft.group)
              throw new BusinessError(`Grupo é obrigatório (produto novo "${draft.name}")`);
            if (productFormCfg.subgroupRequired && !draft.subgroup)
              throw new BusinessError(`Subgrupo é obrigatório (produto novo "${draft.name}")`);
            if (productFormCfg.barcodeRequired && !draft.barcode)
              throw new BusinessError(`Código de barras é obrigatório (produto novo "${draft.name}")`);

            // Custo inicial = custo já rateado (landed cost, 4.9) desta
            // própria entrada — mesma base usada para produtos existentes.
            const landedCost = apportioned[i]!;
            const newProduct = await tx.product.create({
              data: {
                name: draft.name,
                brand: draft.brand ?? '',
                group: draft.group ?? '',
                subgroup: draft.subgroup ?? null,
                companyId,
                variants: {
                  create: [
                    {
                      sku: draft.sku,
                      barcode: draft.barcode ?? null,
                      description: draft.name,
                      costPrice: landedCost,
                      averageCost: landedCost,
                      // Validado no Zod (superRefine): obrigatório quando há newProductData.
                      salePrice: it.newSalePrice!,
                      stockQty: 0,
                      companyId,
                    },
                  ],
                },
              },
              include: { variants: true },
            });
            return { ...it, resolvedVariantId: newProduct.variants[0]!.id };
          }),
        );

        const created = await tx.invoice.create({
          data: {
            supplierId,
            accessKey,
            documentNumber,
            nfeNumber: nfeNumber?.trim() || null,
            issueDate,
            entryDate,
            totalAmount,
            freight,
            otherExpenses,
            companyId,
            items: {
              create: resolvedItems.map((it) => ({
                variantId: it.resolvedVariantId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                cfop: it.cfop,
                companyId,
              })),
            },
          },
          include: { items: true },
        });

        // Entrada de estoque + custo + CMP + (novo preço de venda, opcional).
        // Produtos recém-criados entram com stockQty=0/averageCost=landedCost
        // (acima), então o CMP aqui só confirma o mesmo valor (estoque<=0 →
        // calcWeightedAverageCost retorna o custo exato desta entrada) — um
        // único código para os dois casos, sem bifurcar a lógica.
        for (const [i, it] of resolvedItems.entries()) {
          const landedCost = apportioned[i]!;
          const current = await tx.productVariant.findFirst({
            where: { id: it.resolvedVariantId },
            select: { stockQty: true, averageCost: true },
          });
          if (!current) throw new NotFoundError('Produto');
          const newAvg = calcWeightedAverageCost(current.stockQty, Number(current.averageCost), it.quantity, landedCost);
          await tx.productVariant.update({
            where: { id: it.resolvedVariantId },
            data: {
              stockQty: { increment: it.quantity },
              costPrice: landedCost,
              averageCost: newAvg,
              ...(it.newSalePrice != null ? { salePrice: it.newSalePrice } : {}),
            },
          });
          await tx.stockMovement.create({
            data: {
              variantId: it.resolvedVariantId,
              type: 'IN',
              quantity: it.quantity,
              reason: 'INVOICE',
              refId: created.id,
              // Ledger reflete quando a mercadoria entrou fisicamente na loja
              // (entryDate), não a emissão da NFe nem o instante do confirm.
              createdAt: entryDate,
              companyId,
            },
          });
        }

        // Persistir De/Para para notas futuras — funciona também para
        // produtos recém-criados: a próxima nota do mesmo fornecedor com o
        // mesmo cProd/cEAN já chega auto-mapeada.
        // `upsert` não é coberto pela extensão withTenant (seletor único) —
        // refeito manualmente como findFirst (escopado) + create/update.
        const toMap = resolvedItems.filter((it) => it.saveMapping && it.supplierItemCode);
        for (const it of toMap) {
          const existingMapping = await tx.supplierProductMapping.findFirst({
            where: { supplierId, supplierItemCode: it.supplierItemCode! },
          });
          if (existingMapping) {
            await tx.supplierProductMapping.update({
              where: { id: existingMapping.id },
              data: { variantId: it.resolvedVariantId, supplierBarcode: it.supplierBarcode ?? null },
            });
          } else {
            await tx.supplierProductMapping.create({
              data: {
                supplierId,
                supplierItemCode: it.supplierItemCode!,
                supplierBarcode: it.supplierBarcode ?? null,
                variantId: it.resolvedVariantId,
                companyId,
              },
            });
          }
        }

        // Contas a Pagar: customInstallments tem prioridade; fallback para duplicatas do XML
        const financialRows = customInstallments?.length
          ? customInstallments.map((inst, i) => ({
              type: 'PAYABLE' as const,
              description: `Compra #${documentNumber} - Parcela ${i + 1}/${customInstallments.length}`,
              amount: inst.amount,
              dueDate: inst.dueDate,
              status: 'PENDING',
              invoiceId: created.id,
              personId: supplierId,
              companyId,
            }))
          : duplicates.map((d) => ({
              type: 'PAYABLE' as const,
              description: `Compra #${documentNumber} - Dup ${d.number ?? ''}`.trim(),
              amount: d.amount,
              dueDate: d.dueDate,
              status: 'PENDING',
              invoiceId: created.id,
              personId: supplierId,
              companyId,
            }));

        if (financialRows.length) {
          await tx.financialAccount.createMany({ data: financialRows });
        }

        return created;
      });

      return reply.status(201).send(serializeDecimals(invoice));
    },
  );

  /**
   * POST /api/invoices/manual
   * Compra manual (sem XML): cria uma nota interna, dá entrada de estoque na
   * variante (StockMovement IN), atualiza custo e — se marcado — o controle de
   * lote/validade. Fornecedor pode ser existente ou criado na hora.
   */
  r.post(
    '/manual',
    { preHandler: app.authorize(['ADMIN']), schema: { body: manualPurchaseSchema } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const { supplierId, supplierName, purchaseDate, notes, items, freight, otherExpenses, installments } = req.body;

      const variantIds = [...new Set(items.map((i) => i.variantId))];
      const variants = await db.productVariant.findMany({ where: { id: { in: variantIds } } });
      if (variants.length !== variantIds.length) throw new NotFoundError('Produto');
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // Landed cost (4.9): custo unitário rateado (embute frete/outras
      // despesas) — usado para costPrice/averageCost. InvoiceItem.unitCost
      // continua guardando o valor original informado pelo operador.
      const productsTotal = items.reduce((a, it) => a + it.quantity * it.unitCost, 0);
      const apportioned = apportionLandedCost(items, freight, otherExpenses);
      const total = Math.round((productsTotal + freight + otherExpenses) * 100) / 100;

      // Validação opcional das parcelas: soma = total da compra (produtos + despesas extras).
      if (installments && installments.length) {
        const instSum = installments.reduce((a, i) => a + i.amount, 0);
        if (Math.abs(instSum - total) > 0.01) {
          throw new BusinessError('A soma das parcelas difere do total da compra');
        }
      }

      const invoice = await db.$transaction(async (tx) => {
        // Fornecedor: usa o existente ou cria um novo.
        let supId = supplierId;
        if (!supId) {
          const created = await tx.person.create({
            data: { type: 'SUPPLIER', name: supplierName!, companyId },
          });
          supId = created.id;
        }

        // Nº de documento sequencial (D4).
        const last = await tx.invoice.aggregate({ _max: { documentNumber: true } });
        const documentNumber = (last._max.documentNumber ?? 0) + 1;

        const created = await tx.invoice.create({
          data: {
            supplierId: supId,
            accessKey: `MANUAL-${crypto.randomUUID()}`,
            documentNumber,
            notes: notes ?? null,
            issueDate: purchaseDate,
            totalAmount: total,
            freight,
            otherExpenses,
            companyId,
            items: {
              create: items.map((it) => ({
                variantId: it.variantId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                cfop: 'MANUAL',
                companyId,
              })),
            },
          },
        });

        // Entrada de estoque + custo + CMP + (novo preço de venda) + lote/validade por item.
        for (const [i, it] of items.entries()) {
          const landedCost = apportioned[i]!;
          const variant = variantById.get(it.variantId)!;
          const newAvg = calcWeightedAverageCost(variant.stockQty, Number(variant.averageCost), it.quantity, landedCost);
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: {
              stockQty: { increment: it.quantity },
              costPrice: landedCost,
              averageCost: newAvg,
              ...(it.newSalePrice != null ? { salePrice: it.newSalePrice } : {}),
              ...(it.tracksLotValidity ? { batch: it.batch ?? null, validity: it.validity ?? null } : {}),
            },
          });
          if (it.tracksLotValidity) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { tracksLotValidity: true },
            });
          }
          await tx.stockMovement.create({
            data: {
              variantId: it.variantId,
              type: 'IN',
              quantity: it.quantity,
              reason: 'INVOICE',
              refId: created.id,
              companyId,
            },
          });
        }

        // Contas a pagar parceladas (D7).
        if (installments && installments.length) {
          await tx.financialAccount.createMany({
            data: installments.map((inst, i) => ({
              type: 'PAYABLE',
              description: `Compra #${documentNumber} - Parcela ${i + 1}/${installments.length}`,
              amount: inst.amount,
              dueDate: inst.dueDate,
              status: 'PENDING',
              invoiceId: created.id,
              personId: supId,
              companyId,
            })),
          });
        }

        return created;
      });

      return reply.status(201).send(serializeDecimals(invoice));
    },
  );

  // Detalhe de uma compra/nota.
  r.get('/:id', { preHandler: app.authenticate, schema: { params: idParam } }, async (req) => {
    const { db } = tenantDb(req);
    const invoice = await db.invoice.findFirst({
      where: { id: req.params.id },
      include: {
        supplier: true,
        items: { include: { variant: { include: { product: true } } } },
        financialAccounts: true,
      },
    });
    if (!invoice) throw new NotFoundError('Compra');
    return serializeDecimals(invoice);
  });

  /**
   * PUT /api/invoices/:id
   * Sem `items` no body: edita só metadados (observação, data, nº de
   * documento, fornecedor) — não mexe em estoque/financeiro.
   * Com `items`: edição completa (Mini-PDV de Compras), espelhando
   * `updateSale` (services/sales.ts) — estorna o estoque da nota antiga,
   * remove itens/financeiro antigos, regrava os novos itens recalculando o
   * CMP (mesma fórmula de /confirm e /manual) e recria as contas a pagar.
   * Bloqueada se alguma conta a pagar já tiver baixa registrada.
   */
  r.put(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: updateInvoiceSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const { notes, purchaseDate, documentNumber, supplierId, items, freight, otherExpenses, installments } = req.body;

      if (!items) {
        const existingMeta = await db.invoice.findFirst({ where: { id: req.params.id } });
        if (!existingMeta) throw new NotFoundError('Compra');
        const invoice = await db.invoice.update({
          where: { id: req.params.id },
          data: {
            ...(notes !== undefined ? { notes } : {}),
            ...(purchaseDate ? { issueDate: purchaseDate } : {}),
            ...(documentNumber !== undefined ? { documentNumber } : {}),
            ...(supplierId ? { supplierId } : {}),
          },
        });
        return serializeDecimals(invoice);
      }

      const existing = await db.invoice.findFirst({
        where: { id: req.params.id },
        include: { items: true, financialAccounts: { include: { settlements: true } } },
      });
      if (!existing) throw new NotFoundError('Compra');
      const hasSettled = existing.financialAccounts.some(
        (a) => a.settlements.length > 0 || a.status !== 'PENDING',
      );
      if (hasSettled) {
        throw new BusinessError(
          'Há contas a pagar desta compra com baixa registrada. Estorne as baixas antes de editar.',
        );
      }

      // Landed cost (4.9): custo unitário rateado (embute frete/outras
      // despesas) — usado para costPrice/averageCost. Omitidos, tratados
      // como 0 (mesmo default de /manual quando o campo não é enviado).
      const freightValue = freight ?? 0;
      const otherExpensesValue = otherExpenses ?? 0;
      const productsTotal = items.reduce((a, it) => a + it.quantity * it.unitCost, 0);
      const apportioned = apportionLandedCost(items, freightValue, otherExpensesValue);
      const total = Math.round((productsTotal + freightValue + otherExpensesValue) * 100) / 100;
      if (installments && installments.length) {
        const instSum = installments.reduce((a, i) => a + i.amount, 0);
        if (Math.abs(instSum - total) > 0.01) {
          throw new BusinessError('A soma das parcelas difere do total da compra');
        }
      }

      const updated = await db.$transaction(async (tx) => {
        // 1. Estorna o estoque dos itens antigos (mesma simplificação já usada
        //    no DELETE: não tenta reverter o CMP, só o saldo físico — reverter
        //    a média ponderada exigiria conhecer o estoque/custo médio de
        //    antes desta nota, que não é guardado à parte).
        for (const it of existing.items) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stockQty: { decrement: it.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              variantId: it.variantId,
              type: 'OUT',
              quantity: -it.quantity,
              reason: 'INVOICE_EDIT',
              refId: existing.id,
              companyId,
            },
          });
        }

        // 2. Remove itens e financeiro antigos.
        await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
        await tx.financialAccount.deleteMany({ where: { invoiceId: existing.id } });

        // 3. Valida as variantes novas (escopadas por tenant) e captura o
        //    estoque já estornado (passo 1).
        const variantIds = [...new Set(items.map((i) => i.variantId))];
        const variants = await tx.productVariant.findMany({ where: { id: { in: variantIds } } });
        if (variants.length !== variantIds.length) throw new NotFoundError('Produto');
        const variantById = new Map(variants.map((v) => [v.id, v]));

        // 4. Atualiza os metadados e regrava os itens.
        const invoice = await tx.invoice.update({
          where: { id: existing.id },
          data: {
            ...(supplierId ? { supplierId } : {}),
            ...(notes !== undefined ? { notes } : {}),
            ...(purchaseDate ? { issueDate: purchaseDate } : {}),
            ...(documentNumber !== undefined ? { documentNumber } : {}),
            totalAmount: total,
            freight: freightValue,
            otherExpenses: otherExpensesValue,
            items: {
              create: items.map((it) => ({
                variantId: it.variantId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                cfop: 'MANUAL',
                companyId,
              })),
            },
          },
        });

        // 5. Entrada de estoque + custo + CMP + (novo preço de venda) + lote/validade.
        for (const [i, it] of items.entries()) {
          const landedCost = apportioned[i]!;
          const variant = variantById.get(it.variantId)!;
          const newAvg = calcWeightedAverageCost(variant.stockQty, Number(variant.averageCost), it.quantity, landedCost);
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: {
              stockQty: { increment: it.quantity },
              costPrice: landedCost,
              averageCost: newAvg,
              ...(it.newSalePrice != null ? { salePrice: it.newSalePrice } : {}),
              ...(it.tracksLotValidity ? { batch: it.batch ?? null, validity: it.validity ?? null } : {}),
            },
          });
          if (it.tracksLotValidity) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { tracksLotValidity: true },
            });
          }
          await tx.stockMovement.create({
            data: {
              variantId: it.variantId,
              type: 'IN',
              quantity: it.quantity,
              reason: 'INVOICE',
              refId: invoice.id,
              companyId,
            },
          });
        }

        // 6. Contas a pagar (se enviadas).
        if (installments && installments.length) {
          await tx.financialAccount.createMany({
            data: installments.map((inst, i) => ({
              type: 'PAYABLE',
              description: `Compra #${invoice.documentNumber ?? invoice.id.slice(-6)} - Parcela ${i + 1}/${installments.length}`,
              amount: inst.amount,
              dueDate: inst.dueDate,
              status: 'PENDING',
              invoiceId: invoice.id,
              personId: invoice.supplierId,
              companyId,
            })),
          });
        }

        return invoice;
      });

      return serializeDecimals(updated);
    },
  );

  // Exclusão: estorna o estoque e remove as contas a pagar pendentes. Bloqueia
  // se alguma conta a pagar da compra já foi baixada.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const invoice = await db.invoice.findFirst({
        where: { id: req.params.id },
        include: { items: true, financialAccounts: true },
      });
      if (!invoice) throw new NotFoundError('Compra');
      if (invoice.financialAccounts.some((a) => a.status === 'PAID')) {
        throw new BusinessError('Compra possui contas a pagar já baixadas e não pode ser excluída.');
      }

      await db.$transaction(async (tx) => {
        for (const it of invoice.items) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stockQty: { decrement: it.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              variantId: it.variantId,
              type: 'OUT',
              quantity: -it.quantity,
              reason: 'INVOICE_DELETE',
              refId: invoice.id,
              companyId,
            },
          });
        }
        await tx.financialAccount.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoice.delete({ where: { id: invoice.id } });
      });

      return reply.status(204).send();
    },
  );

  // Upsert manual de um vínculo De/Para. `upsert` não é coberto pela extensão
  // withTenant (seletor único) — refeito como findFirst (escopado) + create/update.
  r.post(
    '/mappings',
    { preHandler: app.authenticate, schema: { body: supplierMappingSchema } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const { supplierId, supplierItemCode, supplierBarcode, variantId } = req.body;
      const existing = await db.supplierProductMapping.findFirst({
        where: { supplierId, supplierItemCode },
      });
      const mapping = existing
        ? await db.supplierProductMapping.update({
            where: { id: existing.id },
            data: { variantId, supplierBarcode },
          })
        : await db.supplierProductMapping.create({
            data: { supplierId, supplierItemCode, supplierBarcode, variantId, companyId },
          });
      return reply.status(201).send(mapping);
    },
  );

  // Remove os títulos a pagar pendentes de uma compra (excluir financeiro). Só ADMIN.
  r.delete(
    '/:id/financial',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req, reply) => {
      const { db } = tenantDb(req);
      const invoice = await db.invoice.findFirst({
        where: { id: req.params.id },
        include: { financialAccounts: { include: { settlements: true } } },
      });
      if (!invoice) throw new NotFoundError('Compra');
      const hasSettled = invoice.financialAccounts.some(
        (a) => a.settlements.length > 0 || a.status !== 'PENDING',
      );
      if (hasSettled) {
        throw new BusinessError(
          'Há contas a pagar desta compra com baixa registrada. Estorne as baixas antes.',
        );
      }
      await db.financialAccount.deleteMany({ where: { invoiceId: req.params.id } });
      return reply.status(204).send();
    },
  );

  // Recria os títulos a pagar de uma compra (refazer financeiro). Só ADMIN.
  // Bloqueado se já houver contas a pagar não excluídas (excluir primeiro).
  r.post(
    '/:id/financial',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: {
        params: idParam,
        body: z.object({
          installments: z.array(
            z.object({ dueDate: z.coerce.date(), amount: z.number().positive() }),
          ).min(1, 'Informe ao menos uma parcela'),
        }),
      },
    },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const invoice = await db.invoice.findFirst({
        where: { id: req.params.id },
        include: { financialAccounts: true },
      });
      if (!invoice) throw new NotFoundError('Compra');
      if (invoice.financialAccounts.length > 0) {
        throw new BusinessError('Exclua o financeiro atual antes de refazê-lo.');
      }
      const { installments } = req.body;
      await db.financialAccount.createMany({
        data: installments.map((inst, i) => ({
          type: 'PAYABLE',
          description: `Compra #${invoice.documentNumber ?? invoice.id.slice(-6)} - Parcela ${i + 1}/${installments.length}`,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: 'PENDING',
          invoiceId: invoice.id,
          personId: invoice.supplierId,
          companyId,
        })),
      });
      return reply.status(201).send({ created: installments.length });
    },
  );

  // Listagem de notas (inclui financialAccounts resumido para exibir status)
  r.get('/', { preHandler: app.authenticate, schema: { querystring: paginationQuery } }, async (req) => {
    const { db } = tenantDb(req);
    const { page, pageSize } = req.query;
    const [total, items] = await Promise.all([
      db.invoice.count(),
      db.invoice.findMany({
        include: {
          supplier: true,
          items: true,
          financialAccounts: { select: { id: true, status: true, amount: true } },
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // Adiciona hasFinancial e totalFinancial para a tela de consulta.
    const withMeta = items.map((inv) => ({
      ...serializeDecimals(inv),
      hasFinancial: inv.financialAccounts.length > 0,
      totalFinancial: inv.financialAccounts.reduce((a, f) => a + Number(f.amount), 0),
    }));
    return { total, page, pageSize, items: withMeta };
  });
}
