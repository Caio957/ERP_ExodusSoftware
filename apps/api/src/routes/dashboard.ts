import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../lib/prisma.js';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Dashboard financeiro (ADMIN): visão do período definido pelo cliente.
 * Vendas (total/quantidade/ticket), recebimentos por forma, série diária e
 * situação de contas a pagar/receber (em aberto e vencidas).
 */
export async function dashboardRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { querystring: z.object({ from: z.coerce.date(), to: z.coerce.date() }) },
    },
    async (req) => {
      const { from, to } = req.query;
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);

      const sales = await prisma.sale.findMany({
        where: { soldAt: { gte: from, lte: toEnd } },
        include: { payments: true },
      });

      const salesTotal = round2(sales.reduce((a, s) => a + Number(s.totalAmount), 0));
      const salesCount = sales.length;

      // Recebimentos por forma de pagamento.
      const methodMap = new Map<string, number>();
      for (const s of sales)
        for (const p of s.payments) methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + Number(p.amount));
      const byMethod = [...methodMap.entries()]
        .map(([method, total]) => ({ method, total: round2(total) }))
        .sort((a, b) => b.total - a.total);

      // Série diária de vendas (para gráfico).
      const dayMap = new Map<string, number>();
      for (const s of sales) {
        const d = s.soldAt.toISOString().slice(0, 10);
        dayMap.set(d, (dayMap.get(d) ?? 0) + Number(s.totalAmount));
      }
      const dailySales = [...dayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total: round2(total) }));

      // Situação atual de contas a pagar/receber (saldo aberto e vencido).
      const accounts = await prisma.financialAccount.findMany({
        where: { status: { not: 'PAID' } },
        include: { settlements: true },
      });
      const now = new Date();
      let payableOpen = 0;
      let receivableOpen = 0;
      let payableOverdue = 0;
      let receivableOverdue = 0;
      for (const a of accounts) {
        const saldo = Number(a.amount) - a.settlements.reduce((x, s) => x + Number(s.amount), 0);
        if (saldo <= 0.001) continue;
        const overdue = a.dueDate < now;
        if (a.type === 'PAYABLE') {
          payableOpen += saldo;
          if (overdue) payableOverdue += saldo;
        } else {
          receivableOpen += saldo;
          if (overdue) receivableOverdue += saldo;
        }
      }

      return {
        period: { from, to },
        salesTotal,
        salesCount,
        ticket: salesCount ? round2(salesTotal / salesCount) : 0,
        byMethod,
        dailySales,
        payableOpen: round2(payableOpen),
        receivableOpen: round2(receivableOpen),
        payableOverdue: round2(payableOverdue),
        receivableOverdue: round2(receivableOverdue),
      };
    },
  );
}
