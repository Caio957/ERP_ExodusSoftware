import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createSaleSchema, syncSalesSchema, updateSaleSchema, paginationQuery } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { createSale, updateSale, deleteSale, setSaleFinancialGenerated } from '../services/sales.js';
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
        include: {
          items: { include: { variant: { include: { product: true } } } },
          client: true,
          payments: true,
          financialAccounts: { orderBy: { dueDate: 'asc' } },
        },
      });
      if (!sale) throw new NotFoundError('Venda');
      return serializeDecimals(sale);
    },
  );

  // Edita a venda por completo (estorna estoque + refaz financeiro). Só ADMIN.
  r.put(
    '/:id',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: z.object({ id: z.string().uuid() }), body: updateSaleSchema },
    },
    async (req) => {
      const sale = await updateSale(req.params.id, req.body);
      return serializeDecimals(sale);
    },
  );

  // Exclui a venda (estorna estoque + remove financeiro vinculado). Só ADMIN.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      await deleteSale(req.params.id);
      return reply.status(204).send();
    },
  );

  // Exclui o financeiro da venda: deixa de contar no caixa/recebimentos e oculta
  // as contas a receber vinculadas (status "sem financeiro gerado"). Só ADMIN.
  r.delete(
    '/:id/financial',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const sale = await setSaleFinancialGenerated(req.params.id, false);
      return serializeDecimals(sale);
    },
  );

  // Regera o financeiro da venda (volta a contar no caixa/recebimentos). Só ADMIN.
  r.post(
    '/:id/financial',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const sale = await setSaleFinancialGenerated(req.params.id, true);
      return serializeDecimals(sale);
    },
  );
}
