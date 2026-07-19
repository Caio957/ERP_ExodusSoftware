import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createFinancialAccountSchema,
  createInstallmentsSchema,
  updateFinancialAccountSchema,
  settleAccountSchema,
  listFinancialQuerySchema,
  type CashRegisterType,
} from '@exodus/shared';
import { serializeDecimals } from '../lib/serialize.js';
import { AppError, BusinessError, NotFoundError } from '../lib/errors.js';
import { tenantDb, type TenantClient } from '../lib/tenant.js';

const idParam = z.object({ id: z.string().uuid() });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Formato mínimo que o `tx` de um `db.$transaction` (client escopado por
// tenant) precisa satisfazer para estes dois helpers — evita lutar contra os
// tipos genéricos internos que o Prisma Client Extensions cunha (branding),
// que fazem `Prisma.TransactionClient` e o `tx` estendido não serem
// diretamente atribuíveis um ao outro mesmo tendo os mesmos métodos na prática.
type FinancialTxClient = {
  cashRegister: {
    findFirst(args: {
      where: { userId: string; status: string; type: CashRegisterType };
    }): Promise<{ id: string } | null>;
  };
  cashTransaction: {
    findFirst(args: {
      where: { description: string; amount: Prisma.Decimal; type: string };
      orderBy: { createdAt: 'desc' };
      include: { cashRegister: { select: { type: true } } };
    }): Promise<{ cashRegister: { type: string } } | null>;
  };
};

/**
 * Meia-noite de hoje no horário da loja (America/Sao_Paulo, UTC-3) — não usa
 * `new Date().setHours(0,0,0,0)` porque em produção (Railway) o processo roda
 * em UTC, não no fuso da loja; mesmo raciocínio já documentado em
 * `routes/cash.ts` (relatório periódico).
 */
function todayStartBr(): Date {
  const localDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${localDateStr}T00:00:00.000-03:00`);
}

/**
 * Garante que o operador logado tem, especificamente, o caixa do tipo
 * escolhido (DIARIO/BANCO) aberto antes de mexer em dinheiro (baixa/estorno)
 * — sem esse caixa aberto não há onde registrar a `CashTransaction` de
 * compensação. Substitui o antigo `requireOpenRegister` (pegava o primeiro
 * caixa aberto que encontrasse, sem distinguir tipo — ambíguo desde que
 * passou a ser possível ter DIARIO e BANCO abertos ao mesmo tempo para o
 * mesmo operador).
 */
async function requireRegisterOfType(
  tx: FinancialTxClient,
  userId: string,
  type: CashRegisterType,
) {
  const register = await tx.cashRegister.findFirst({ where: { userId, status: 'OPEN', type } });
  if (!register) {
    throw new AppError(
      400,
      `Não há um caixa ${type === 'DIARIO' ? 'Físico' : 'Conta Banco'} aberto para o usuário logado.`,
    );
  }
  return register;
}

/**
 * Descobre em qual TIPO de caixa (DIARIO/BANCO) uma baixa foi originalmente
 * lançada — o estorno precisa sair do mesmo "livro" onde o dinheiro entrou,
 * nunca de um escolhido livremente pelo operador (principio de partidas
 * dobradas: perguntar abriria margem para furo contábil). `AccountSettlement`
 * não tem FK direta para `CashTransaction` (o `/settle` grava as duas em
 * paralelo, sem vínculo formal no schema) — a correlação é feita pela
 * assinatura exata que o `/settle` sempre grava para a baixa: mesma descrição
 * (`Baixa: {descrição do título}`), mesmo valor e mesmo `type` (SUPPLY para
 * RECEIVABLE, BLEED para PAYABLE). `orderBy: createdAt desc` porque estamos
 * sempre estornando a baixa mais recente do título — a `CashTransaction` mais
 * recente com essa assinatura é a correspondente.
 */
async function findOriginalRegisterType(
  tx: FinancialTxClient,
  account: { type: string; description: string },
  settlement: { amount: Prisma.Decimal },
): Promise<CashRegisterType> {
  const original = await tx.cashTransaction.findFirst({
    where: {
      description: `Baixa: ${account.description}`,
      amount: settlement.amount,
      type: account.type === 'RECEIVABLE' ? 'SUPPLY' : 'BLEED',
    },
    orderBy: { createdAt: 'desc' },
    include: { cashRegister: { select: { type: true } } },
  });
  if (!original) {
    throw new AppError(
      400,
      'Não foi possível identificar o caixa onde esta baixa foi originalmente lançada.',
    );
  }
  return original.cashRegister.type as CashRegisterType;
}

/**
 * Garante que o título pode ser alterado/excluído. Bloqueia títulos de origem
 * nota/entrada (invoiceId), de venda (saleId) e os que já têm baixa registrada
 * (precisam ser estornados antes) — preserva a integridade (E7). `findFirst`
 * (em vez de `findUnique`) escopa por tenant via a extensão `db`.
 */
async function assertEditable(db: TenantClient, id: string) {
  const account = await db.financialAccount.findFirst({
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

export async function financialRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Resumo financeiro é sensível: somente ADMIN (Requisito 4.5)
  r.get(
    '/',
    {
      preHandler: app.authorize(['ADMIN']),
      schema: { querystring: listFinancialQuerySchema },
    },
    async (req) => {
      const { db } = tenantDb(req);
      const { page, pageSize, type, status, personId, search, dueFrom, dueTo, orderBy, orderDir, statusFilter } =
        req.query;

      // `statusFilter` é semântico (Abertos/Vencidos/A Vencer/Parcial/Quitado) e,
      // quando diferente de 'ALL', tem precedência sobre `status`/dueFrom/dueTo
      // simples no cálculo do status/vencimento.
      const statusFilterWhere: Prisma.FinancialAccountWhereInput =
        statusFilter === 'PAID'
          ? { status: 'PAID' }
          : statusFilter === 'PARTIAL'
            ? { status: 'PARTIAL' }
            : statusFilter === 'OPEN'
              ? { status: { in: ['PENDING', 'PARTIAL'] } }
              : statusFilter === 'OVERDUE'
                ? { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: todayStartBr() } }
                : statusFilter === 'NOT_OVERDUE'
                  ? { status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { gte: todayStartBr() } }
                  : {};

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
        ...statusFilterWhere,
        // Oculta contas a receber de vendas com o financeiro excluído.
        AND: [{ OR: [{ saleId: null }, { sale: { financialGenerated: true } }] }],
      };

      // Mapeia o campo de ordenação pedido pela tela para a coluna real do
      // banco; desempate por código quando a ordenação não é pelo próprio código.
      const orderByMap: Record<typeof orderBy, Prisma.FinancialAccountOrderByWithRelationInput> = {
        code: { code: orderDir },
        description: { description: orderDir },
        dueDate: { dueDate: orderDir },
        amount: { amount: orderDir },
      };
      const orderByClauses: Prisma.FinancialAccountOrderByWithRelationInput[] = [orderByMap[orderBy]];
      if (orderBy !== 'code') orderByClauses.push({ code: 'asc' });

      const [total, items] = await Promise.all([
        db.financialAccount.count({ where }),
        db.financialAccount.findMany({
          where,
          include: { person: true, settlements: true },
          orderBy: orderByClauses,
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
      const { db, companyId } = tenantDb(req);
      const account = await db.financialAccount.create({
        data: { ...req.body, status: 'PENDING', companyId },
      });
      return reply.status(201).send(serializeDecimals(account));
    },
  );

  // Lançamento manual com geração de parcelas.
  r.post(
    '/installments',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createInstallmentsSchema } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
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
          companyId,
        };
      });

      await db.financialAccount.createMany({ data });
      return reply.status(201).send({ created: data.length });
    },
  );

  // Baixa (total ou parcial) de um título (E1).
  r.post(
    '/:id/settle',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: settleAccountSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      return db.$transaction(async (tx) => {
        const openRegister = await requireRegisterOfType(tx, req.user.sub, req.body.targetRegisterType);

        const account = await tx.financialAccount.findFirst({
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
          data: { financialAccountId: account.id, amount: valor, paidAt: req.body.paidAt, companyId },
        });

        // Reflete a baixa no caixa aberto: recebimento (RECEIVABLE) entra como
        // suprimento; pagamento (PAYABLE) sai como sangria.
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: openRegister.id,
            type: account.type === 'RECEIVABLE' ? 'SUPPLY' : 'BLEED',
            amount: valor,
            description: `Baixa: ${account.description}`,
            companyId,
          },
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

  // Estorno: remove a ÚLTIMA baixa e recalcula o status (E2). O caixa de
  // destino da compensação NÃO é escolhido pelo operador — é inferido a
  // partir de onde a baixa original entrou (findOriginalRegisterType), para
  // preservar a rastreabilidade contábil (partidas dobradas).
  r.post(
    '/:id/reverse',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      return db.$transaction(async (tx) => {
        const account = await tx.financialAccount.findFirst({
          where: { id: req.params.id },
          include: { settlements: { orderBy: { createdAt: 'desc' } } },
        });
        if (!account) throw new NotFoundError('Lançamento');
        const last = account.settlements[0];
        if (!last) throw new BusinessError('Não há baixa para estornar');

        const originalType = await findOriginalRegisterType(tx, account, last);
        const openRegister = await requireRegisterOfType(tx, req.user.sub, originalType);

        await tx.accountSettlement.delete({ where: { id: last.id } });

        // Compensação inversa da baixa: estornar um recebimento (RECEIVABLE)
        // tira o dinheiro do caixa (sangria); estornar um pagamento (PAYABLE)
        // devolve o dinheiro ao caixa (suprimento).
        await tx.cashTransaction.create({
          data: {
            cashRegisterId: openRegister.id,
            type: account.type === 'RECEIVABLE' ? 'BLEED' : 'SUPPLY',
            amount: Number(last.amount),
            description: `Estorno de Baixa: ${account.description}`,
            companyId,
          },
        });

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
      const { db } = tenantDb(req);
      await assertEditable(db, req.params.id);
      const account = await db.financialAccount.update({
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
      const { db } = tenantDb(req);
      await assertEditable(db, req.params.id);
      await db.financialAccount.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );
}
