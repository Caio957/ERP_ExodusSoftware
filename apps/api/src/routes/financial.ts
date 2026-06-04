import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createFinancialAccountSchema,
  createInstallmentsSchema,
  updateFinancialAccountSchema,
  payAccountSchema,
  paginationQuery,
  FinancialAccountType,
  FinancialAccountStatus,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

const idParam = z.object({ id: z.string().uuid() });

export async function financialRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Garante que o título pode ser alterado/excluído pelo usuário. Títulos
   * originados de uma nota/entrada (invoiceId) são protegidos — não podem ser
   * mexidos manualmente para preservar a integridade com a origem.
   */
  async function assertEditable(id: string) {
    const account = await prisma.financialAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundError('Lançamento');
    if (account.invoiceId) {
      throw new BusinessError(
        'Lançamento originado de uma nota/entrada e não pode ser editado ou excluído.',
      );
    }
    return account;
  }

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

  // Lançamento manual simples (1 título).
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

  // Lançamento manual com geração de parcelas.
  r.post(
    '/installments',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createInstallmentsSchema } },
    async (req, reply) => {
      const { type, description, totalAmount, firstDueDate, installments, intervalDays, personId } =
        req.body;

      const cents = Math.round(totalAmount * 100);
      const base = Math.floor(cents / installments);
      const data = Array.from({ length: installments }, (_, i) => {
        // A última parcela absorve o arredondamento.
        const amountCents = i < installments - 1 ? base : cents - base * (installments - 1);
        const due = new Date(firstDueDate);
        due.setDate(due.getDate() + i * intervalDays);
        return {
          type,
          description:
            installments > 1 ? `${description} (${i + 1}/${installments})` : description,
          amount: amountCents / 100,
          dueDate: due,
          status: 'PENDING',
          personId: personId ?? null,
        };
      });

      await prisma.financialAccount.createMany({ data });
      return reply.status(201).send({ created: data.length });
    },
  );

  r.post(
    '/:id/pay',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: idParam, body: payAccountSchema },
    },
    async (req) => {
      const account = await prisma.financialAccount.update({
        where: { id: req.params.id },
        data: { status: 'PAID', paidAt: req.body.paidAt },
      });
      return serializeDecimals(account);
    },
  );

  // Edição de título manual (bloqueado para origem nota/entrada).
  r.put(
    '/:id',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { params: idParam, body: updateFinancialAccountSchema },
    },
    async (req) => {
      await assertEditable(req.params.id);
      const account = await prisma.financialAccount.update({
        where: { id: req.params.id },
        data: req.body,
      });
      return serializeDecimals(account);
    },
  );

  // Exclusão de título manual (bloqueado para origem nota/entrada).
  r.delete(
    '/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req, reply) => {
      await assertEditable(req.params.id);
      await prisma.financialAccount.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );
}
