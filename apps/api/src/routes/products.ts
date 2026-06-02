import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createProductSchema,
  updateProductSchema,
  updateVariantSchema,
  paginationQuery,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { NotFoundError } from '../lib/errors.js';

export async function productRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Lista paginada com busca por nome/marca/SKU/código de barras
  r.get('/', { schema: { querystring: paginationQuery } }, async (req) => {
    const { page, pageSize, search } = req.query;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { brand: { contains: search, mode: 'insensitive' as const } },
            { variants: { some: { sku: { contains: search, mode: 'insensitive' as const } } } },
            { variants: { some: { barcode: { contains: search } } } },
          ],
        }
      : {};

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
}
