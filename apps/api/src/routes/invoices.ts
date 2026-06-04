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
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { parseNfeXml } from '../services/nfe-parser.js';
import { BusinessError, ConflictError, NotFoundError } from '../lib/errors.js';

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
    const raw = parseNfeXml(req.body.xml);

    const supplier = raw.supplier.document
      ? await prisma.person.findUnique({ where: { document: raw.supplier.document } })
      : null;

    const codes = raw.items.map((i) => i.supplierItemCode);
    const barcodes = raw.items.map((i) => i.supplierBarcode).filter((b): b is string => !!b);

    const [mappings, variantsByBarcode] = await Promise.all([
      supplier
        ? prisma.supplierProductMapping.findMany({
            where: { supplierId: supplier.id, supplierItemCode: { in: codes } },
          })
        : Promise.resolve([]),
      barcodes.length
        ? prisma.productVariant.findMany({ where: { barcode: { in: barcodes } } })
        : Promise.resolve([]),
    ]);

    const mapByCode = new Map(mappings.map((m) => [m.supplierItemCode, m.variantId]));
    const mapByBarcode = new Map(variantsByBarcode.map((v) => [v.barcode!, v.id]));

    const items = raw.items.map((item) => ({
      ...item,
      matchedVariantId:
        mapByCode.get(item.supplierItemCode) ??
        (item.supplierBarcode ? mapByBarcode.get(item.supplierBarcode) : undefined) ??
        null,
    }));

    return {
      accessKey: raw.accessKey,
      issueDate: raw.issueDate,
      supplier: { ...raw.supplier, existingId: supplier?.id ?? null },
      totalAmount: raw.totalAmount,
      items,
      duplicates: raw.duplicates,
      alreadyImported: raw.accessKey
        ? !!(await prisma.invoice.findUnique({ where: { accessKey: raw.accessKey } }))
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
      const { supplierId, accessKey, issueDate, totalAmount, items, duplicates } = req.body;

      const exists = await prisma.invoice.findUnique({ where: { accessKey } });
      if (exists) throw new ConflictError('Nota fiscal já importada', { accessKey });

      const invoice = await prisma.$transaction(async (tx) => {
        const created = await tx.invoice.create({
          data: {
            supplierId,
            accessKey,
            issueDate,
            totalAmount,
            items: {
              create: items.map((it) => ({
                variantId: it.variantId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                cfop: it.cfop,
              })),
            },
          },
          include: { items: true },
        });

        // Entrada de estoque + razão
        for (const it of items) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stockQty: { increment: it.quantity }, costPrice: it.unitCost },
          });
          await tx.stockMovement.create({
            data: {
              variantId: it.variantId,
              type: 'IN',
              quantity: it.quantity,
              reason: 'INVOICE',
              refId: created.id,
            },
          });
        }

        // Persistir De/Para para notas futuras
        const toMap = items.filter((it) => it.saveMapping && it.supplierItemCode);
        for (const it of toMap) {
          await tx.supplierProductMapping.upsert({
            where: {
              supplierId_supplierItemCode: {
                supplierId,
                supplierItemCode: it.supplierItemCode!,
              },
            },
            create: {
              supplierId,
              supplierItemCode: it.supplierItemCode!,
              supplierBarcode: it.supplierBarcode ?? null,
              variantId: it.variantId,
            },
            update: { variantId: it.variantId, supplierBarcode: it.supplierBarcode ?? null },
          });
        }

        // Contas a Pagar a partir das duplicatas
        if (duplicates.length) {
          await tx.financialAccount.createMany({
            data: duplicates.map((d) => ({
              type: 'PAYABLE',
              description: `NF ${accessKey.slice(-6)} - dup ${d.number ?? ''}`.trim(),
              amount: d.amount,
              dueDate: d.dueDate,
              status: 'PENDING',
              invoiceId: created.id,
              personId: supplierId,
            })),
          });
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
      const { supplierId, supplierName, purchaseDate, notes, items, installments } = req.body;

      const variantIds = [...new Set(items.map((i) => i.variantId))];
      const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
      if (variants.length !== variantIds.length) throw new NotFoundError('Produto');
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // Validação opcional das parcelas: soma = total da compra.
      const total = items.reduce((a, it) => a + it.quantity * it.unitCost, 0);
      if (installments && installments.length) {
        const instSum = installments.reduce((a, i) => a + i.amount, 0);
        if (Math.abs(instSum - total) > 0.01) {
          throw new BusinessError('A soma das parcelas difere do total da compra');
        }
      }

      const invoice = await prisma.$transaction(async (tx) => {
        // Fornecedor: usa o existente ou cria um novo.
        let supId = supplierId;
        if (!supId) {
          const created = await tx.person.create({ data: { type: 'SUPPLIER', name: supplierName! } });
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
            totalAmount: Number(total.toFixed(2)),
            items: {
              create: items.map((it) => ({
                variantId: it.variantId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                cfop: 'MANUAL',
              })),
            },
          },
        });

        // Entrada de estoque + custo + (novo preço de venda) + lote/validade por item.
        for (const it of items) {
          const variant = variantById.get(it.variantId)!;
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: {
              stockQty: { increment: it.quantity },
              costPrice: it.unitCost,
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
            data: { variantId: it.variantId, type: 'IN', quantity: it.quantity, reason: 'INVOICE', refId: created.id },
          });
        }

        // Contas a pagar parceladas (D7).
        if (installments && installments.length) {
          await tx.financialAccount.createMany({
            data: installments.map((inst, i) => ({
              type: 'PAYABLE',
              description: `Compra #${documentNumber} - parcela ${i + 1}/${installments.length}`,
              amount: inst.amount,
              dueDate: inst.dueDate,
              status: 'PENDING',
              invoiceId: created.id,
              personId: supId,
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
    const invoice = await prisma.invoice.findUnique({
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

  // Edição de metadados (observação, data, nº de documento). Não altera itens.
  r.put(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: updateInvoiceSchema } },
    async (req) => {
      const invoice = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
          ...(req.body.purchaseDate ? { issueDate: req.body.purchaseDate } : {}),
          ...(req.body.documentNumber !== undefined ? { documentNumber: req.body.documentNumber } : {}),
        },
      });
      return serializeDecimals(invoice);
    },
  );

  // Exclusão: estorna o estoque e remove as contas a pagar pendentes. Bloqueia
  // se alguma conta a pagar da compra já foi baixada.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req, reply) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.id },
        include: { items: true, financialAccounts: true },
      });
      if (!invoice) throw new NotFoundError('Compra');
      if (invoice.financialAccounts.some((a) => a.status === 'PAID')) {
        throw new BusinessError('Compra possui contas a pagar já baixadas e não pode ser excluída.');
      }

      await prisma.$transaction(async (tx) => {
        for (const it of invoice.items) {
          await tx.productVariant.update({
            where: { id: it.variantId },
            data: { stockQty: { decrement: it.quantity } },
          });
          await tx.stockMovement.create({
            data: { variantId: it.variantId, type: 'OUT', quantity: -it.quantity, reason: 'INVOICE_DELETE', refId: invoice.id },
          });
        }
        await tx.financialAccount.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoice.delete({ where: { id: invoice.id } });
      });

      return reply.status(204).send();
    },
  );

  // Upsert manual de um vínculo De/Para
  r.post(
    '/mappings',
    { preHandler: app.authenticate, schema: { body: supplierMappingSchema } },
    async (req, reply) => {
      const { supplierId, supplierItemCode, supplierBarcode, variantId } = req.body;
      const mapping = await prisma.supplierProductMapping.upsert({
        where: { supplierId_supplierItemCode: { supplierId, supplierItemCode } },
        create: { supplierId, supplierItemCode, supplierBarcode, variantId },
        update: { variantId, supplierBarcode },
      });
      return reply.status(201).send(mapping);
    },
  );

  // Listagem de notas
  r.get('/', { preHandler: app.authenticate, schema: { querystring: paginationQuery } }, async (req) => {
    const { page, pageSize } = req.query;
    const [total, items] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.findMany({
        include: { supplier: true, items: true },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: serializeDecimals(items) };
  });
}
