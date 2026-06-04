import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createProductSchema,
  updateProductSchema,
  updateVariantSchema,
  paginationQuery,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

/** Querystring da listagem: paginação + busca livre + filtros dedicados. */
const productListQuery = paginationQuery.extend({
  brand: z.string().trim().min(1).optional(),
  group: z.string().trim().min(1).optional(),
  subgroup: z.string().trim().min(1).optional(),
});

export async function productRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Lista paginada com busca livre (nome/marca/SKU/código) + filtros dedicados.
  // Sem nenhum filtro, retorna TODOS os produtos cadastrados.
  r.get('/', { schema: { querystring: productListQuery } }, async (req) => {
    const { page, pageSize, search, brand, group, subgroup } = req.query;
    const and: Prisma.ProductWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
          { variants: { some: { barcode: { contains: search } } } },
        ],
      });
    }
    if (brand) and.push({ brand: { contains: brand, mode: 'insensitive' } });
    if (group) and.push({ group: { contains: group, mode: 'insensitive' } });
    if (subgroup) and.push({ subgroup: { contains: subgroup, mode: 'insensitive' } });
    const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { variants: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items: serializeDecimals(items) };
  });

  // Busca de variante por código de barras (usado pelo PDV / leitor)
  r.get(
    '/variants/by-barcode/:barcode',
    { schema: { params: z.object({ barcode: z.string().min(1) }) } },
    async (req) => {
      const variant = await prisma.productVariant.findUnique({
        where: { barcode: req.params.barcode },
        include: { product: true },
      });
      if (!variant) throw new NotFoundError('Produto');
      return serializeDecimals(variant);
    },
  );

  r.get(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: { variants: true },
      });
      if (!product) throw new NotFoundError('Produto');
      return serializeDecimals(product);
    },
  );

  // Cria produto + variantes (ADMIN). Estoque inicial gera StockMovement.
  r.post(
    '/',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createProductSchema } },
    async (req, reply) => {
      const { variants, ...productData } = req.body;

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            ...productData,
            variants: {
              create: variants.map((v) => ({
                sku: v.sku,
                barcode: v.barcode,
                description: v.description,
                costPrice: v.costPrice,
                salePrice: v.salePrice,
                stockQty: v.stockQty,
                batch: v.batch,
                validity: v.validity,
              })),
            },
          },
          include: { variants: true },
        });

        // Razão de estoque inicial
        const movements = created.variants
          .filter((v) => v.stockQty > 0)
          .map((v) => ({
            variantId: v.id,
            type: 'IN',
            quantity: v.stockQty,
            reason: 'MANUAL',
          }));
        if (movements.length) await tx.stockMovement.createMany({ data: movements });

        return created;
      });

      return reply.status(201).send(serializeDecimals(product));
    },
  );

  r.put(
    '/:id',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: z.object({ id: z.string().uuid() }), body: updateProductSchema },
    },
    async (req) => {
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: req.body,
        include: { variants: true },
      });
      return serializeDecimals(product);
    },
  );

  r.put(
    '/variants/:id',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: z.object({ id: z.string().uuid() }), body: updateVariantSchema },
    },
    async (req) => {
      const variant = await prisma.productVariant.update({
        where: { id: req.params.id },
        data: req.body,
      });
      return serializeDecimals(variant);
    },
  );

  // Exclusão de produto (ADMIN). Bloqueia se houver vendas ou notas vinculadas
  // às variantes — preserva a integridade histórica do estoque/financeiro.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { id: true, variants: { select: { id: true } } },
      });
      if (!product) throw new NotFoundError('Produto');

      const variantIds = product.variants.map((v) => v.id);
      if (variantIds.length) {
        const [saleCount, invoiceCount] = await Promise.all([
          prisma.saleItem.count({ where: { variantId: { in: variantIds } } }),
          prisma.invoiceItem.count({ where: { variantId: { in: variantIds } } }),
        ]);
        if (saleCount > 0 || invoiceCount > 0) {
          throw new BusinessError(
            'Produto possui vendas ou notas vinculadas e não pode ser excluído.',
          );
        }
      }

      // Cascade remove variantes, movimentos de estoque e mapeamentos De/Para.
      await prisma.product.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );
}
