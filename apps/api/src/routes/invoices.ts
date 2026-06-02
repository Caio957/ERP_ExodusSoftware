import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  parseNfeSchema,
  confirmInvoiceSchema,
  supplierMappingSchema,
  paginationQuery,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { parseNfeXml } from '../services/nfe-parser.js';
import { ConflictError } from '../lib/errors.js';

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
