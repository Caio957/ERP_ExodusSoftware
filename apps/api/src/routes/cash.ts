import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  openCashSchema,
  closeCashSchema,
  cashTransactionSchema,
  updateCashTransactionSchema,
  cashRegisterTypeQuerySchema,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { serializeDecimals, toMoney } from '../lib/serialize.js';
import { AppError, BusinessError, ForbiddenError, NotFoundError } from '../lib/errors.js';

const idParam = z.object({ id: z.string().uuid() });

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Filtro de SalePayment que compõe o saldo esperado — depende do tipo do
 * caixa (4.12): DIARIO é a gaveta física, só dinheiro em espécie conta;
 * BANCO é a conta digital, onde PIX/cartões SÃO o "dinheiro" do livro — só
 * 'A_PRAZO' fica de fora (não é recebimento agora, é conta a receber).
 */
function liquidPaymentFilter(registerType: string): Prisma.SalePaymentWhereInput {
  return registerType === 'DIARIO' ? { method: 'CASH' } : { method: { not: 'A_PRAZO' } };
}

/** Caixa esperado = inicial + suprimentos - sangrias + recebimentos líquidos
 *  do tipo de caixa (dinheiro em espécie no DIARIO; tudo exceto A_PRAZO no
 *  BANCO). Baixas do Financeiro já entram via CashTransaction SUPPLY/BLEED
 *  (`requireOpenRegister`, routes/financial.ts) — esse model não tem campo
 *  `method`, então já é agnóstico ao tipo de caixa, sem precisar de filtro
 *  aqui. */
async function computeExpectedCash(cashRegisterId: string) {
  const register = await prisma.cashRegister.findUnique({ where: { id: cashRegisterId } });
  if (!register) throw new NotFoundError('Caixa');

  const [supplies, bleeds, liquidSales] = await Promise.all([
    prisma.cashTransaction.aggregate({
      where: { cashRegisterId, type: 'SUPPLY' },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: { cashRegisterId, type: 'BLEED' },
      _sum: { amount: true },
    }),
    // Soma os PAGAMENTOS líquidos (não o total da venda) — trata split e a prazo.
    // Ignora vendas com o financeiro excluído (financialGenerated = false).
    prisma.salePayment.aggregate({
      where: { ...liquidPaymentFilter(register.type), sale: { cashRegisterId, financialGenerated: true } },
      _sum: { amount: true },
    }),
  ]);

  const initial = toMoney(register.initialCash) ?? 0;
  const supply = toMoney(supplies._sum.amount) ?? 0;
  const bleed = toMoney(bleeds._sum.amount) ?? 0;
  const cash = toMoney(liquidSales._sum.amount) ?? 0;
  return { register, expectedCash: initial + supply - bleed + cash };
}

export async function cashRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Caixa aberto do operador atual (com saldo esperado em tempo real).
  // Permanece estritamente individual (sem bypass de ADMIN) — abrir/consultar
  // "meu caixa atual" é sempre por userId, com ou sem Conta Banco no jogo.
  r.get(
    '/current',
    { preHandler: app.authenticate, schema: { querystring: cashRegisterTypeQuerySchema } },
    async (req) => {
      const register = await prisma.cashRegister.findFirst({
        where: { userId: req.user.sub, status: 'OPEN', type: req.query.type },
        include: { transactions: { orderBy: { createdAt: 'desc' } } },
      });
      if (!register) return null;
      const { expectedCash } = await computeExpectedCash(register.id);
      return { ...serializeDecimals(register), expectedCash };
    },
  );

  // Abertura. "Já aberto" é checado por tipo — um operador pode ter um caixa
  // físico (DIARIO) e uma conta banco (BANCO) abertos ao mesmo tempo, são
  // livros independentes; o que não pode é abrir dois do mesmo tipo.
  r.post('/open', { preHandler: app.authenticate, schema: { body: openCashSchema } }, async (req, reply) => {
    const existing = await prisma.cashRegister.findFirst({
      where: { userId: req.user.sub, status: 'OPEN', type: req.body.type },
    });
    if (existing) {
      throw new BusinessError(
        req.body.type === 'BANCO' ? 'Você já possui uma conta banco aberta' : 'Você já possui um caixa aberto',
      );
    }

    const register = await prisma.cashRegister.create({
      data: {
        userId: req.user.sub,
        initialCash: req.body.initialCash,
        status: 'OPEN',
        type: req.body.type,
      },
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
        where: { sale: { cashRegisterId: register.id, financialGenerated: true } },
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

  // Histórico de caixas (consulta de outros dias). ADMIN vê todos; operador, os
  // seus — RBAC preservado; `type` é um filtro adicional no mesmo `where`, nunca
  // substitui a checagem de dono.
  r.get(
    '/registers',
    { preHandler: app.authenticate, schema: { querystring: cashRegisterTypeQuerySchema } },
    async (req) => {
      const rbac = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };
      const registers = await prisma.cashRegister.findMany({
        where: { ...rbac, type: req.query.type },
        orderBy: { openedAt: 'desc' },
        take: 60,
        include: { user: { select: { name: true } } },
      });
      return serializeDecimals(registers);
    },
  );

  // Relatório periódico (extrato consolidado): unifica os movimentos de todos
  // os caixas do período (vendas + sangrias/suprimentos) e resume por forma de
  // pagamento + movimentação física da gaveta. RBAC igual ao /registers:
  // ADMIN vê a loja toda; operador vê só os próprios caixas.
  r.get(
    '/report',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: z
          .object({ startDate: z.coerce.date(), endDate: z.coerce.date() })
          .merge(cashRegisterTypeQuerySchema),
      },
    },
    async (req) => {
      const { startDate, endDate } = req.query;
      // Força o timezone UTC-3 (Horário de Brasília) nas fronteiras do relatório.
      // O servidor roda em UTC: uma venda às 23:50 locais de 30/06 é gravada como
      // 02:50 UTC de 01/07. Ancorar as fronteiras com o offset -03:00 explícito
      // (em vez de setUTCHours, que fecharia o dia às 20:59 locais) garante que
      // esses lançamentos noturnos entrem no relatório do dia local correto.
      const startStr = req.query.startDate.toISOString().split('T')[0];
      const endStr = req.query.endDate.toISOString().split('T')[0];

      const start = new Date(`${startStr}T00:00:00.000-03:00`);
      const end = new Date(`${endStr}T23:59:59.999-03:00`);
      const rbac = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };

      // Sem filtro de status: traz caixas OPEN e CLOSED dentro do período.
      // `type` some do RBAC de dono — é só mais uma cláusula no mesmo `where`.
      const registers = await prisma.cashRegister.findMany({
        where: { openedAt: { gte: start, lte: end }, type: req.query.type, ...rbac },
        include: {
          user: { select: { name: true } },
          transactions: true,
          sales: { include: { client: { select: { name: true } }, payments: true } },
        },
      });

      // 1) Timeline consolidada (vendas + transações manuais), mais recente 1º.
      const movements = registers
        .flatMap((reg) => [
          ...reg.transactions.map((t) => ({
            kind: 'TRANSACTION' as const,
            id: t.id,
            type: t.type, // SUPPLY | BLEED
            amount: toMoney(t.amount) ?? 0,
            description: t.description,
            operator: reg.user?.name ?? null,
            at: t.createdAt,
          })),
          ...reg.sales.map((s) => ({
            kind: 'SALE' as const,
            id: s.id,
            code: s.code,
            paymentMethod: s.paymentMethod,
            amount: toMoney(s.totalAmount) ?? 0,
            client: s.client?.name ?? null,
            operator: reg.user?.name ?? null,
            financialGenerated: s.financialGenerated,
            payments: s.payments.map((p) => ({ method: p.method, amount: toMoney(p.amount) ?? 0 })),
            at: s.soldAt,
          })),
        ])
        .sort((a, b) => +new Date(b.at) - +new Date(a.at));

      // 2) Resumo financeiro. Suprimentos/sangrias das transações manuais.
      let totalSupply = 0;
      let totalBleed = 0;
      for (const reg of registers) {
        for (const t of reg.transactions) {
          if (t.type === 'SUPPLY') totalSupply += Number(t.amount);
          else if (t.type === 'BLEED') totalBleed += Number(t.amount);
        }
      }

      // Vendas e recebimentos por forma (só as com financeiro gerado). Vendas
      // legadas sem SalePayment usam paymentMethod + totalAmount como fallback.
      // `registers` já está filtrado por um único `type` (query acima), então
      // o predicado de liquidez é o mesmo para todo o período consultado —
      // mesma regra de computeExpectedCash (DIARIO: só CASH; BANCO: tudo
      // menos A_PRAZO).
      const isLiquid = (method: string) =>
        req.query.type === 'DIARIO' ? method === 'CASH' : method !== 'A_PRAZO';
      let totalSales = 0;
      let salesCount = 0;
      let liquidSales = 0;
      const methodMap = new Map<string, { count: number; total: number }>();
      const addMethod = (method: string, amount: number) => {
        const cur = methodMap.get(method) ?? { count: 0, total: 0 };
        cur.count += 1;
        cur.total += amount;
        methodMap.set(method, cur);
        if (isLiquid(method)) liquidSales += amount;
      };
      for (const reg of registers) {
        for (const s of reg.sales) {
          if (!s.financialGenerated) continue;
          totalSales += Number(s.totalAmount);
          salesCount += 1;
          if (s.payments.length > 0) {
            for (const p of s.payments) addMethod(p.method, Number(p.amount));
          } else {
            addMethod(s.paymentMethod, Number(s.totalAmount));
          }
        }
      }

      const byMethod = [...methodMap.entries()]
        .map(([method, v]) => ({ method, count: v.count, total: round2(v.total) }))
        .sort((a, b) => b.total - a.total);

      // Fundo inicial de todos os caixas encontrados no período (aberturas).
      const totalInitialCash = registers.reduce((a, reg) => a + Number(reg.initialCash), 0);

      // Total recolhido: valor físico declarado no fechamento (finalCash) dos
      // caixas já fechados — sai da gaveta e vai para o cofre/banco.
      const totalCollected = registers
        .filter((r) => r.status === 'CLOSED')
        .reduce((acc, r) => acc + Number(r.finalCash || 0), 0);

      // Saldo do livro (nome da variável mantido por compatibilidade — o
      // frontend rotula como "Dinheiro em gaveta" no DIARIO e "Saldo em
      // Conta" no BANCO, ver CashPage.tsx) = fundo inicial + recebimentos
      // líquidos do tipo (isLiquid acima) + suprimentos - sangrias -
      // fechamentos (recolhimentos).
      const cashInDrawer = round2(
        totalInitialCash + liquidSales + totalSupply - totalBleed - totalCollected,
      );

      return {
        period: { startDate, endDate },
        registersCount: registers.length,
        movements,
        summary: {
          totalSales: round2(totalSales),
          salesCount,
          byMethod,
          totalInitialCash: round2(totalInitialCash),
          totalSupply: round2(totalSupply),
          totalBleed: round2(totalBleed),
          totalCollected: round2(totalCollected),
          cashInDrawer,
        },
      };
    },
  );

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
        code: s.code,
        paymentMethod: s.paymentMethod,
        amount: toMoney(s.totalAmount) ?? 0,
        client: s.client?.name ?? null,
        financialGenerated: s.financialGenerated,
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
      if (tx.description.startsWith('Baixa:') || tx.description.startsWith('Estorno')) {
        throw new AppError(
          400,
          'Movimentações geradas por Vendas ou pelo Financeiro não podem ser alteradas no Caixa. Realize o estorno no módulo de origem.',
        );
      }
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
      if (tx.description.startsWith('Baixa:') || tx.description.startsWith('Estorno')) {
        throw new AppError(
          400,
          'Movimentações geradas por Vendas ou pelo Financeiro não podem ser alteradas no Caixa. Realize o estorno no módulo de origem.',
        );
      }
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
