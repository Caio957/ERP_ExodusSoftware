import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  openCashSchema,
  closeCashSchema,
  cashTransactionSchema,
  updateCashTransactionSchema,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals, toMoney } from '../lib/serialize.js';
import { BusinessError, ForbiddenError, NotFoundError } from '../lib/errors.js';

const idParam = z.object({ id: z.string().uuid() });

/** Caixa esperado = inicial + suprimentos - sangrias + vendas em dinheiro. */
async function computeExpectedCash(cashRegisterId: string) {
  const [register, supplies, bleeds, cashSales] = await Promise.all([
    prisma.cashRegister.findUnique({ where: { id: cashRegisterId } }),
    prisma.cashTransaction.aggregate({
      where: { cashRegisterId, type: 'SUPPLY' },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: { cashRegisterId, type: 'BLEED' },
      _sum: { amount: true },
    }),
    // Soma os PAGAMENTOS em dinheiro (não o total da venda) — trata split e a prazo.
    prisma.salePayment.aggregate({
      where: { method: 'CASH', sale: { cashRegisterId } },
      _sum: { amount: true },
    }),
  ]);
  if (!register) throw new NotFoundError('Caixa');

  const initial = toMoney(register.initialCash) ?? 0;
  const supply = toMoney(supplies._sum.amount) ?? 0;
  const bleed = toMoney(bleeds._sum.amount) ?? 0;
  const cash = toMoney(cashSales._sum.amount) ?? 0;
  return { register, expectedCash: initial + supply - bleed + cash };
}

export async function cashRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Caixa aberto do operador atual (com saldo esperado em tempo real).
  r.get('/current', { preHandler: app.authenticate }, async (req) => {
    const register = await prisma.cashRegister.findFirst({
      where: { userId: req.user.sub, status: 'OPEN' },
      include: { transactions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!register) return null;
    const { expectedCash } = await computeExpectedCash(register.id);
    return { ...serializeDecimals(register), expectedCash };
  });

  // Abertura
  r.post('/open', { preHandler: app.authenticate, schema: { body: openCashSchema } }, async (req, reply) => {
    const existing = await prisma.cashRegister.findFirst({
      where: { userId: req.user.sub, status: 'OPEN' },
    });
    if (existing) throw new BusinessError('Você já possui um caixa aberto');

    const register = await prisma.cashRegister.create({
      data: { userId: req.user.sub, initialCash: req.body.initialCash, status: 'OPEN' },
    });
    return reply.status(201).send(serializeDecimals(register));
  });

  // Sangria / Suprimento
  r.post(
    '/:id/transactions',
    { preHandler: app.authenticate, schema: { params: idParam, body: cashTransactionSchema } },
    async (req, reply) => {
      const register = await prisma.cashRegister.findUnique({ where: { id: req.params.id } });
      if (!register) throw new NotFoundError('Caixa');
      if (register.status !== 'OPEN') throw new BusinessError('Caixa não está aberto');

      const tx = await prisma.cashTransaction.create({
        data: { cashRegisterId: register.id, ...req.body },
      });
      return reply.status(201).send(serializeDecimals(tx));
    },
  );

  // Fechamento (operador pode fechar o próprio caixa)
  r.post(
    '/:id/close',
    { preHandler: app.authenticate, schema: { params: idParam, body: closeCashSchema } },
    async (req) => {
      const { register, expectedCash } = await computeExpectedCash(req.params.id);
      if (register.status !== 'OPEN') throw new BusinessError('Caixa já está fechado');
      if (register.userId !== req.user.sub && req.user.role !== 'ADMIN') {
        throw new ForbiddenError('Você só pode fechar o seu próprio caixa');
      }

      const finalCash = req.body.finalCash;
      const updated = await prisma.cashRegister.update({
        where: { id: register.id },
        data: { status: 'CLOSED', closedAt: new Date(), finalCash },
      });

      return {
        ...serializeDecimals(updated),
        expectedCash,
        difference: Number((finalCash - expectedCash).toFixed(2)),
      };
    },
  );

  // Resumo financeiro detalhado — APENAS ADMIN (Requisito 4.5)
  r.get(
    '/:id/summary',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req) => {
      const { register, expectedCash } = await computeExpectedCash(req.params.id);
      const byMethod = await prisma.salePayment.groupBy({
        by: ['method'],
        where: { sale: { cashRegisterId: register.id } },
        _sum: { amount: true },
        _count: true,
      });

      return {
        cashRegister: serializeDecimals(register),
        expectedCash,
        salesByMethod: byMethod.map((m) => ({
          paymentMethod: m.method,
          count: m._count,
          total: toMoney(m._sum.amount) ?? 0,
        })),
      };
    },
  );

  // Histórico de caixas (consulta de outros dias). ADMIN vê todos; operador, os seus.
  r.get('/registers', { preHandler: app.authenticate }, async (req) => {
    const where = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };
    const registers = await prisma.cashRegister.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 60,
      include: { user: { select: { name: true } } },
    });
    return serializeDecimals(registers);
  });

  // Timeline unificada: sangrias/suprimentos (manuais) + vendas (origem). As
  // vendas vêm como leitura — só podem ser alteradas pela tela de Vendas (C5).
  r.get('/:id/movements', { preHandler: app.authenticate, schema: { params: idParam } }, async (req) => {
    const register = await prisma.cashRegister.findUnique({ where: { id: req.params.id } });
    if (!register) throw new NotFoundError('Caixa');

    const [transactions, sales] = await Promise.all([
      prisma.cashTransaction.findMany({ where: { cashRegisterId: register.id } }),
      prisma.sale.findMany({
        where: { cashRegisterId: register.id },
        include: { client: { select: { name: true } }, payments: true },
      }),
    ]);

    const movements = [
      ...transactions.map((t) => ({
        kind: 'TRANSACTION' as const,
        id: t.id,
        type: t.type, // SUPPLY | BLEED
        amount: toMoney(t.amount) ?? 0,
        description: t.description,
        at: t.createdAt,
      })),
      ...sales.map((s) => ({
        kind: 'SALE' as const,
        id: s.id,
        paymentMethod: s.paymentMethod,
        amount: toMoney(s.totalAmount) ?? 0,
        client: s.client?.name ?? null,
        payments: s.payments.map((p) => ({ method: p.method, amount: toMoney(p.amount) ?? 0 })),
        at: s.soldAt,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

    return { register: serializeDecimals(register), movements };
  });

  // Edita uma sangria/suprimento manual (somente com o caixa aberto).
  r.put(
    '/transactions/:id',
    { preHandler: app.authenticate, schema: { params: idParam, body: updateCashTransactionSchema } },
    async (req) => {
      const tx = await prisma.cashTransaction.findUnique({
        where: { id: req.params.id },
        include: { cashRegister: true },
      });
      if (!tx) throw new NotFoundError('Movimentação');
      if (tx.cashRegister.status !== 'OPEN') {
        throw new BusinessError('Caixa fechado não pode ser alterado');
      }
      const updated = await prisma.cashTransaction.update({ where: { id: tx.id }, data: req.body });
      return serializeDecimals(updated);
    },
  );

  // Exclui uma sangria/suprimento manual (somente com o caixa aberto).
  r.delete(
    '/transactions/:id',
    { preHandler: app.authenticate, schema: { params: idParam } },
    async (req, reply) => {
      const tx = await prisma.cashTransaction.findUnique({
        where: { id: req.params.id },
        include: { cashRegister: true },
      });
      if (!tx) throw new NotFoundError('Movimentação');
      if (tx.cashRegister.status !== 'OPEN') {
        throw new BusinessError('Caixa fechado não pode ser alterado');
      }
      await prisma.cashTransaction.delete({ where: { id: tx.id } });
      return reply.status(204).send();
    },
  );

  r.get('/:id', { preHandler: app.authenticate, schema: { params: idParam } }, async (req) => {
    const register = await prisma.cashRegister.findUnique({
      where: { id: req.params.id },
      include: { transactions: true, sales: true },
    });
    if (!register) throw new NotFoundError('Caixa');
    return serializeDecimals(register);
  });
}
