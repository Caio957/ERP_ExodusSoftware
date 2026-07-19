import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createSaleSchema,
  syncSalesSchema,
  updateSaleSchema,
  paginationQuery,
  regenerateSaleFinancialSchema,
} from '@exodus/shared';
import { serializeDecimals } from '../lib/serialize.js';
import { createSale, updateSale, deleteSale, setSaleFinancialGenerated } from '../services/sales.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { tenantDb } from '../lib/tenant.js';

export async function saleRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Venda unitária (online)
  r.post('/', { preHandler: app.authenticate, schema: { body: createSaleSchema } }, async (req, reply) => {
    const { db, companyId } = tenantDb(req);
    const { sale, deduped } = await createSale(db, companyId, req.body, req.user.sub);
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
      const { db, companyId } = tenantDb(req);
      const results = [];
      for (const sale of req.body.sales) {
        try {
          const { sale: saved, deduped } = await createSale(db, companyId, sale, req.user.sub);
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

  // RBAC (isolamento de dados): ADMIN vê todas as vendas da loja; CASHIER só
  // as próprias (Sale.userId — operador que registrou). A tela /vendas é
  // ADMIN-only no frontend, mas o endpoint em si não tinha nenhuma trava —
  // um CASHIER chamando a API diretamente enxergava vendas de todo mundo.
  // Agora combinado com o escopo por tenant (withTenant), que já garante
  // isolamento entre empresas por baixo desse filtro de papel.
  r.get('/', { preHandler: app.authenticate, schema: { querystring: paginationQuery } }, async (req) => {
    const { db } = tenantDb(req);
    const { page, pageSize } = req.query;
    const userFilter = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };
    const [total, items] = await Promise.all([
      db.sale.count({ where: userFilter }),
      db.sale.findMany({
        where: userFilter,
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
      const { db } = tenantDb(req);
      const sale = await db.sale.findFirst({
        where: { id: req.params.id },
        include: {
          items: { include: { variant: { include: { product: true } } } },
          client: true,
          payments: true,
          financialAccounts: { orderBy: { dueDate: 'asc' } },
          // Rastreabilidade (4.13): em qual caixa (DIARIO/BANCO) a venda foi
          // registrada — exibido no ViewSaleModal (SalesPage.tsx).
          cashRegister: { select: { type: true } },
        },
      });
      if (!sale) throw new NotFoundError('Venda');
      // findFirst já escopa por tenant (companyId injetado pela extensão); a
      // checagem de posse por operador (ADMIN vê tudo, CASHIER só o próprio)
      // continua sendo pós-fetch, já que não dá pra combinar id+userId+companyId
      // num único seletor único do Prisma.
      if (req.user.role !== 'ADMIN' && sale.userId !== req.user.sub) {
        throw new ForbiddenError('Você só pode visualizar suas próprias vendas');
      }
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
      const { db, companyId } = tenantDb(req);
      const sale = await updateSale(db, companyId, req.params.id, req.body, req.user.sub);
      return serializeDecimals(sale);
    },
  );

  // Exclui a venda (estorna estoque + remove financeiro vinculado). Só ADMIN.
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      await deleteSale(db, req.params.id, companyId);
      return reply.status(204).send();
    },
  );

  // Exclui o financeiro da venda: deixa de contar no caixa/recebimentos e oculta
  // as contas a receber vinculadas (status "sem financeiro gerado"). Só ADMIN.
  r.delete(
    '/:id/financial',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const { db } = tenantDb(req);
      const sale = await setSaleFinancialGenerated(db, req.params.id, false);
      return serializeDecimals(sale);
    },
  );

  // Regera o financeiro da venda (volta a contar no caixa/recebimentos). Só ADMIN.
  // `targetRegisterType` opcional: realoca a venda para o caixa aberto do
  // usuário logado daquele tipo (DIARIO/BANCO) em vez do caixa de origem.
  r.post(
    '/:id/financial',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: z.object({ id: z.string().uuid() }), body: regenerateSaleFinancialSchema },
    },
    async (req) => {
      const { db } = tenantDb(req);
      const sale = await setSaleFinancialGenerated(db, req.params.id, true, {
        userId: req.user.sub,
        targetRegisterType: req.body.targetRegisterType,
      });
      return serializeDecimals(sale);
    },
  );
}
