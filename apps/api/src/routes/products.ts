import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createProductSchema,
  updateProductSchema,
  updateVariantSchema,
  stockAdjustSchema,
  listProductsQuerySchema,
  productFormSettingsSchema,
} from '@exodus/shared';
import { serializeDecimals } from '../lib/serialize.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';
import { getSetting } from '../lib/settings.js';
import { tenantDb } from '../lib/tenant.js';

export async function productRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Lista paginada com busca livre (nome/marca/SKU/código) + filtros + ordenação.
  // Sem nenhum filtro, retorna TODOS os produtos cadastrados.
  // Ganhou `preHandler: app.authenticate` nesta rodada — este e os outros 2
  // GETs abaixo (by-barcode, /:id) não tinham NENHUMA autenticação antes
  // (achado ao mapear rotas para a Fase 4): sem req.user não há companyId
  // para escopar, então virar autenticado é pré-requisito, não só reforço.
  r.get(
    '/',
    { preHandler: app.authenticate, schema: { querystring: listProductsQuerySchema } },
    async (req) => {
      const { db } = tenantDb(req);
      const { page, pageSize, search, brand, group, subgroup, orderBy, orderDir } = req.query;
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

      // name/code → ordenação direta no Prisma; sku/price → em memória após
      // o fetch (Prisma não expõe _min em relações 1-N via TypeScript types).
      const dir = orderDir;
      const prismaOrderBy: Prisma.ProductOrderByWithRelationInput =
        orderBy === 'code' ? { code: dir } :
        orderBy === 'name' ? { name: dir } :
        { name: 'asc' }; // fallback neutro para sku/price

      const [total, rawItems] = await Promise.all([
        db.product.count({ where }),
        db.product.findMany({
          where,
          include: { variants: true },
          orderBy: prismaOrderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      let items = rawItems;
      if (orderBy === 'sku') {
        items = [...rawItems].sort((a, b) => {
          const av = a.variants[0]?.sku ?? '';
          const bv = b.variants[0]?.sku ?? '';
          const cmp = av.localeCompare(bv);
          return dir === 'desc' ? -cmp : cmp;
        });
      } else if (orderBy === 'price') {
        items = [...rawItems].sort((a, b) => {
          const av = Number(a.variants[0]?.salePrice ?? 0);
          const bv = Number(b.variants[0]?.salePrice ?? 0);
          return dir === 'asc' ? av - bv : bv - av;
        });
      }

      return { total, page, pageSize, items: serializeDecimals(items) };
    },
  );

  // Busca de variante por código de barras (usado pelo PDV / leitor)
  r.get(
    '/variants/by-barcode/:barcode',
    { preHandler: app.authenticate, schema: { params: z.object({ barcode: z.string().min(1) }) } },
    async (req) => {
      const { db } = tenantDb(req);
      const variant = await db.productVariant.findFirst({
        where: { barcode: req.params.barcode },
        include: { product: true },
      });
      if (!variant) throw new NotFoundError('Produto');
      return serializeDecimals(variant);
    },
  );

  r.get(
    '/:id',
    { preHandler: app.authenticate, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const { db } = tenantDb(req);
      const product = await db.product.findFirst({
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
      const { db, companyId } = tenantDb(req);
      const { variants, ...productData } = req.body;

      // Obrigatoriedade configurável (Configurações da loja).
      const setting = await getSetting(companyId, 'product_form', db);
      const cfg = productFormSettingsSchema.parse(setting?.value ?? {});
      if (cfg.brandRequired && !productData.brand) throw new BusinessError('Marca é obrigatória');
      if (cfg.groupRequired && !productData.group) throw new BusinessError('Grupo é obrigatório');
      if (cfg.subgroupRequired && !productData.subgroup)
        throw new BusinessError('Subgrupo é obrigatório');
      if (cfg.barcodeRequired && variants.some((v) => !v.barcode))
        throw new BusinessError('Código de barras é obrigatório');

      const product = await db.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            name: productData.name,
            brand: productData.brand ?? '',
            group: productData.group ?? '',
            subgroup: productData.subgroup ?? null,
            tracksLotValidity: productData.tracksLotValidity,
            companyId,
            variants: {
              create: variants.map((v) => ({
                sku: v.sku,
                barcode: v.barcode,
                // Fallback: usa o nome do produto quando a descrição é omitida.
                description: v.description?.trim() || productData.name,
                costPrice: v.costPrice,
                averageCost: v.averageCost ?? v.costPrice,
                salePrice: v.salePrice,
                stockQty: v.stockQty,
                batch: v.batch,
                validity: v.validity,
                companyId,
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
            companyId,
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
      const { db } = tenantDb(req);
      const existing = await db.product.findFirst({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Produto');
      const product = await db.product.update({
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
      const { db } = tenantDb(req);
      const existing = await db.productVariant.findFirst({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Produto');
      const variant = await db.productVariant.update({
        where: { id: req.params.id },
        data: req.body,
      });
      return serializeDecimals(variant);
    },
  );

  // Acerto de estoque (inventário): define a quantidade física e registra a
  // diferença como StockMovement ADJUST.
  r.post(
    '/adjust-stock',
    { preHandler: app.authorize(['ADMIN']), schema: { body: stockAdjustSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const { variantId, newQuantity, reason } = req.body;
      const variant = await db.productVariant.findFirst({ where: { id: variantId } });
      if (!variant) throw new NotFoundError('Produto');

      const diff = newQuantity - variant.stockQty;
      const updated = await db.$transaction(async (tx) => {
        const v = await tx.productVariant.update({
          where: { id: variantId },
          data: { stockQty: newQuantity },
        });
        if (diff !== 0) {
          // Código sequencial só dos acertos (type='ADJUST') — StockMovement é
          // um razão compartilhado com vendas/notas, então não dá pra usar um
          // autoincrement de banco sem misturar a numeração com outros tipos.
          // Escopado por tenant: cada empresa tem sua própria sequência #1, #2...
          const last = await tx.stockMovement.aggregate({
            _max: { code: true },
            where: { type: 'ADJUST' },
          });
          const code = (last._max.code ?? 0) + 1;
          await tx.stockMovement.create({
            data: {
              variantId,
              type: 'ADJUST',
              quantity: diff,
              reason: `ADJUST: ${reason}`,
              code,
              companyId,
            },
          });
        }
        return v;
      });
      return serializeDecimals(updated);
    },
  );

  // Histórico de acertos de estoque (StockMovement ADJUST). Só ADMIN.
  r.get('/stock-adjustments', { preHandler: app.authorize(['ADMIN']) }, async (req) => {
    const { db } = tenantDb(req);
    const movements = await db.stockMovement.findMany({
      where: { type: 'ADJUST' },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return movements.map((m) => ({
      id: m.id,
      code: m.code,
      variantId: m.variantId,
      quantity: m.quantity, // diferença aplicada (+/-)
      reason: m.reason.replace(/^ADJUST:\s*/, ''),
      createdAt: m.createdAt,
      product: m.variant.product.name,
      description: m.variant.description,
      sku: m.variant.sku,
      currentStock: m.variant.stockQty,
    }));
  });

  // Edita um acerto: aplica no estoque apenas a diferença entre o novo e o
  // antigo valor do ajuste (recalcula o estoque internamente). Só ADMIN.
  r.put(
    '/stock-adjustments/:id',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          quantity: z.number().int(),
          reason: z.string().trim().min(1, 'Informe o motivo').max(200),
        }),
      },
    },
    async (req) => {
      const { db } = tenantDb(req);
      const { quantity, reason } = req.body;
      return db.$transaction(async (tx) => {
        const m = await tx.stockMovement.findFirst({ where: { id: req.params.id } });
        if (!m || m.type !== 'ADJUST') throw new NotFoundError('Acerto de estoque');
        const delta = quantity - m.quantity;
        if (delta !== 0) {
          await tx.productVariant.update({
            where: { id: m.variantId },
            data: { stockQty: { increment: delta } },
          });
        }
        const updated = await tx.stockMovement.update({
          where: { id: m.id },
          data: { quantity, reason: `ADJUST: ${reason}` },
        });
        return serializeDecimals(updated);
      });
    },
  );

  // Apaga um acerto: reverte a diferença aplicada no estoque. Só ADMIN.
  r.delete(
    '/stock-adjustments/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      const { db } = tenantDb(req);
      await db.$transaction(async (tx) => {
        const m = await tx.stockMovement.findFirst({ where: { id: req.params.id } });
        if (!m || m.type !== 'ADJUST') throw new NotFoundError('Acerto de estoque');
        await tx.productVariant.update({
          where: { id: m.variantId },
          data: { stockQty: { decrement: m.quantity } },
        });
        await tx.stockMovement.delete({ where: { id: m.id } });
      });
      return reply.status(204).send();
    },
  );

  // Exclusão de produto (ADMIN). Bloqueia se houver vendas ou notas vinculadas
  // às variantes — preserva a integridade histórica do estoque/financeiro.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      const { db } = tenantDb(req);
      const product = await db.product.findFirst({
        where: { id: req.params.id },
        select: { id: true, variants: { select: { id: true } } },
      });
      if (!product) throw new NotFoundError('Produto');

      const variantIds = product.variants.map((v) => v.id);
      if (variantIds.length) {
        const [saleCount, invoiceCount] = await Promise.all([
          db.saleItem.count({ where: { variantId: { in: variantIds } } }),
          db.invoiceItem.count({ where: { variantId: { in: variantIds } } }),
        ]);
        if (saleCount > 0 || invoiceCount > 0) {
          throw new BusinessError(
            'Produto possui vendas ou notas vinculadas e não pode ser excluído.',
          );
        }
      }

      // Cascade remove variantes, movimentos de estoque e mapeamentos De/Para.
      await db.product.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );
}
