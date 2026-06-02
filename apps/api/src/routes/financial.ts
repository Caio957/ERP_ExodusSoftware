import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createFinancialAccountSchema,
  payAccountSchema,
  paginationQuery,
  FinancialAccountType,
  FinancialAccountStatus,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';

export async function financialRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Resumo financeiro é sensível: somente ADMIN (Requisito 4.5)
  r.get(
    '/',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: {
        querystring: paginationQuery.extend({
          type: FinancialAccountType.optional(),
          status: FinancialAccountStatus.optional(),
        }),
      },
    },
    async (req) => {
      const { page, pageSize, type, status } = req.query;
      const where = { ...(type ? { type } : {}), ...(status ? { status } : {}) };
      const [total, items] = await Promise.all([
        prisma.financialAccount.count({ where }),
        prisma.financialAccount.findMany({
          where,
          include: { person: true },
          orderBy: { dueDate: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { total, page, pageSize, items: serializeDecimals(items) };
    },
  );

  r.post(
    '/',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createFinancialAccountSchema } },
    async (req, reply) => {
      const account = await prisma.financialAccount.create({
        data: { ...req.body, status: 'PENDING' },
      });
      return reply.status(201).send(serializeDecimals(account));
    },
  );

  r.post(
    '/:id/pay',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: z.object({ id: z.string().uuid() }), body: payAccountSchema },
    },
    async (req) => {
      const account = await prisma.financialAccount.update({
        where: { id: req.params.id },
        data: { status: 'PAID', paidAt: req.body.paidAt },
      });
      return serializeDecimals(account);
    },
  );
}
