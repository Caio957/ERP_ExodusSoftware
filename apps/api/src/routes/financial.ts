import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createFinancialAccountSchema,
  createInstallmentsSchema,
  updateFinancialAccountSchema,
  settleAccountSchema,
  paginationQuery,
  FinancialAccountType,
  FinancialAccountStatus,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals } from '../lib/serialize.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

const idParam = z.object({ id: z.string().uuid() });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function financialRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Garante que o título pode ser alterado/excluído. Bloqueia títulos de origem
   * nota/entrada (invoiceId), de venda (saleId) e os que já têm baixa registrada
   * (precisam ser estornados antes) — preserva a integridade (E7).
   */
  async function assertEditable(id: string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id },
      include: { settlements: true },
    });
    if (!account) throw new NotFoundError('Lançamento');
    if (account.invoiceId || account.saleId) {
      throw new BusinessError(
        'Lançamento originado de nota/venda e não pode ser editado ou excluído manualmente.',
      );
    }
    if (account.status !== 'PENDING' || account.settlements.length > 0) {
      throw new BusinessError('Título com baixa não pode ser alterado. Estorne a baixa antes.');
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
          personId: z.string().uuid().optional(),
          dueFrom: z.coerce.date().optional(),
          dueTo: z.coerce.date().optional(),
        }),
      },
    },
    async (req) => {
      const { page, pageSize, type, status, personId, search, dueFrom, dueTo } = req.query;
      const where: Prisma.FinancialAccountWhereInput = {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(personId ? { personId } : {}),
        ...(search
          ? {
              OR: [
                { description: { contains: search, mode: 'insensitive' } },
                { person: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(dueFrom || dueTo
          ? { dueDate: { ...(dueFrom ? { gte: dueFrom } : {}), ...(dueTo ? { lte: dueTo } : {}) } }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.financialAccount.count({ where }),
        prisma.financialAccount.findMany({
          where,
          include: { person: true, settlements: true },
          orderBy: [{ dueDate: 'asc' }, { code: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      // Inclui o valor já baixado (paidAmount) para a tela calcular o saldo.
      const withPaid = items.map((it) => ({
        ...serializeDecimals(it),
        paidAmount: round2(it.settlements.reduce((a, s) => a + Number(s.amount), 0)),
      }));
      return { total, page, pageSize, items: withPaid };
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

  // Baixa (total ou parcial) de um título (E1).
  r.post(
    '/:id/settle',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: settleAccountSchema } },
    async (req) => {
      return prisma.$transaction(async (tx) => {
        const account = await tx.financialAccount.findUnique({
          where: { id: req.params.id },
          include: { settlements: true },
        });
        if (!account) throw new NotFoundError('Lançamento');
        if (account.status === 'PAID') throw new BusinessError('Título já está quitado');

        const total = Number(account.amount);
        const paid = account.settlements.reduce((a, s) => a + Number(s.amount), 0);
        const saldo = round2(total - paid);
        const valor = req.body.amount != null ? req.body.amount : saldo;
        if (valor <= 0) throw new BusinessError('Valor da baixa deve ser maior que zero');
        if (valor > saldo + 0.001) throw new BusinessError('Valor maior que o saldo do título');

        await tx.accountSettlement.create({
          data: { financialAccountId: account.id, amount: valor, paidAt: req.body.paidAt },
        });

        const newPaid = round2(paid + valor);
        // Quita se atingiu o total ou se o usuário optou por quitar com valor menor.
        const quitado = req.body.settleInFull || newPaid >= total - 0.001;
        const updated = await tx.financialAccount.update({
          where: { id: account.id },
          data: { status: quitado ? 'PAID' : 'PARTIAL', paidAt: quitado ? req.body.paidAt : null },
        });
        return serializeDecimals(updated);
      });
    },
  );

  // Estorno: remove a ÚLTIMA baixa e recalcula o status (E2).
  r.post(
    '/:id/reverse',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req) => {
      return prisma.$transaction(async (tx) => {
        const account = await tx.financialAccount.findUnique({
          where: { id: req.params.id },
          include: { settlements: { orderBy: { createdAt: 'desc' } } },
        });
        if (!account) throw new NotFoundError('Lançamento');
        const last = account.settlements[0];
        if (!last) throw new BusinessError('Não há baixa para estornar');

        await tx.accountSettlement.delete({ where: { id: last.id } });
        const remaining = account.settlements.slice(1).reduce((a, s) => a + Number(s.amount), 0);
        const updated = await tx.financialAccount.update({
          where: { id: account.id },
          data: { status: remaining > 0.001 ? 'PARTIAL' : 'PENDING', paidAt: null },
        });
        return serializeDecimals(updated);
      });
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
