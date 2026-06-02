import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createSaleSchema, syncSalesSchema, paginationQuery } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { createSale } from '../services/sales.js';
import { NotFoundError } from '../lib/errors.js';

export async function saleRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Venda unitária (online)
  r.post('/', { preHandler: app.authenticate, schema: { body: createSaleSchema } }, async (req, reply) => {
    const { sale, deduped } = await createSale(req.body, req.user.sub);
    return reply.status(deduped ? 200 : 201).send(serializeDecimals(sale));
  });

  /**
   * POST /api/sales/sync
   * Recebe o lote da fila offline (Dexie). Processa item a item de forma
   * idempotente e tolerante a falhas: uma venda problemática não derruba o
   * lote inteiro — retorna o status individual de cada uma (Requisito 4.4).
   */
  r.post(
    '/sync',
    { preHandler: app.authenticate, schema: { body: syncSalesSchema } },
    async (req) => {
      const results = [];
      for (const sale of req.body.sales) {
        try {
          const { sale: saved, deduped } = await createSale(sale, req.user.sub);
          results.push({
            clientRef: sale.clientRef ?? null,
            status: deduped ? 'DUPLICATE' : 'CREATED',
            id: saved.id,
          });
        } catch (err) {
          req.log.error({ err, clientRef: sale.clientRef }, 'Falha ao sincronizar venda');
          results.push({
            clientRef: sale.clientRef ?? null,
            status: 'ERROR',
            message: err instanceof Error ? err.message : 'Erro desconhecido',
          });
        }
      }
      return { processed: results.length, results };
    },
  );

  r.get('/', { preHandler: app.authenticate, schema: { querystring: paginationQuery } }, async (req) => {
    const { page, pageSize } = req.query;
    const [total, items] = await Promise.all([
      prisma.sale.count(),
      prisma.sale.findMany({
        include: { items: true, client: true },
        orderBy: { soldAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: serializeDecimals(items) };
  });

  r.get(
    '/:id',
    { preHandler: app.authenticate, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const sale = await prisma.sale.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { variant: { include: { product: true } } } }, client: true },
      });
      if (!sale) throw new NotFoundError('Venda');
      return serializeDecimals(sale);
    },
  );
}
