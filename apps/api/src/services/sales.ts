import type { CreateSaleInput, UpdateSaleInput } from '@exodus/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BusinessError, NotFoundError } from '../lib/errors.js';

/** Soma os itens (subtotal bruto). */
function sumItems(items: { unitPrice: number; quantity: number }[]) {
  return items.reduce(
    (acc, it) => acc.add(new Prisma.Decimal(it.unitPrice).mul(it.quantity)),
    new Prisma.Decimal(0),
  );
}

/**
 * Cria uma venda de forma idempotente e atômica.
 *  - O total é recalculado no servidor (não confia no cliente).
 *  - Baixa o estoque e registra o razão (StockMovement OUT).
 *  - Se `clientRef` já existir, retorna a venda existente (evita duplicar na
 *    sincronização da fila offline - Requisito 4.4).
 */
export async function createSale(input: CreateSaleInput, userId: string) {
  // Idempotência: venda já sincronizada anteriormente.
  if (input.clientRef) {
    const existing = await prisma.sale.findUnique({
      where: { clientRef: input.clientRef },
      include: { items: true },
    });
    if (existing) return { sale: existing, deduped: true };
  }

  const register = await prisma.cashRegister.findUnique({
    where: { id: input.cashRegisterId },
  });
  if (!register) throw new NotFoundError('Caixa');
  if (register.status !== 'OPEN') throw new BusinessError('Caixa não está aberto');

  const subtotal = input.items.reduce(
    (acc, it) => acc.add(new Prisma.Decimal(it.unitPrice).mul(it.quantity)),
    new Prisma.Decimal(0),
  );
  const discount = new Prisma.Decimal(input.discount ?? 0);
  const surcharge = new Prisma.Decimal(input.surcharge ?? 0);
  const total = subtotal.sub(discount).add(surcharge);
  if (total.lessThan(0)) throw new BusinessError('Desconto maior que o total da venda');

  // Formas de pagamento (default: pagamento único no valor total).
  const payments =
    input.payments && input.payments.length > 0
      ? input.payments
      : [{ method: input.paymentMethod, amount: total.toNumber() }];
  const cent = new Prisma.Decimal('0.01');
  const paidSum = payments.reduce((a, p) => a.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
  if (paidSum.sub(total).abs().greaterThan(cent)) {
    throw new BusinessError('A soma das formas de pagamento difere do total da venda');
  }

  // Parte "A prazo" → gera contas a receber parceladas.
  const aPrazoTotal = payments
    .filter((p) => p.method === 'A_PRAZO')
    .reduce((a, p) => a.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
  const installments = input.installments ?? [];
  if (aPrazoTotal.greaterThan(0)) {
    if (!input.clientId) throw new BusinessError('Venda a prazo exige um cliente');
    if (installments.length === 0) throw new BusinessError('Informe as parcelas da venda a prazo');
    const instSum = installments.reduce((a, i) => a.add(new Prisma.Decimal(i.amount)), new Prisma.Decimal(0));
    if (instSum.sub(aPrazoTotal).abs().greaterThan(cent)) {
      throw new BusinessError('A soma das parcelas difere do valor a prazo');
    }
  }

  const legacyMethod = payments.length === 1 ? payments[0]!.method : 'SPLIT';

  try {
    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          cashRegisterId: input.cashRegisterId,
          userId,
          clientId: input.clientId ?? null,
          paymentMethod: legacyMethod,
          subtotal,
          discount,
          surcharge,
          totalAmount: total,
          notes: input.notes ?? null,
          syncStatus: 'SYNCED',
          clientRef: input.clientRef ?? null,
          soldAt: input.soldAt ?? new Date(),
          items: {
            create: input.items.map((it) => ({
              variantId: it.variantId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            })),
          },
          payments: {
            create: payments.map((p) => ({ method: p.method, amount: p.amount })),
          },
        },
        include: { items: true, payments: true },
      });

      // Contas a receber das parcelas a prazo.
      if (aPrazoTotal.greaterThan(0)) {
        await tx.financialAccount.createMany({
          data: installments.map((inst, i) => ({
            type: 'RECEIVABLE',
            description: `Venda a prazo ${i + 1}/${installments.length}`,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: 'PENDING',
            saleId: created.id,
            personId: input.clientId!,
          })),
        });
      }

      // Baixa de estoque + razão. Loja física já entregou o produto, então
      // permitimos estoque negativo (sinaliza ajuste posterior).
      for (const it of input.items) {
        await tx.productVariant.update({
          where: { id: it.variantId },
          data: { stockQty: { decrement: it.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            variantId: it.variantId,
            type: 'OUT',
            quantity: -it.quantity,
            reason: 'SALE',
            refId: created.id,
          },
        });
      }

      return created;
    });

    return { sale, deduped: false };
  } catch (err) {
    // Corrida na sincronização: outro request gravou o mesmo clientRef primeiro.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      input.clientRef
    ) {
      const existing = await prisma.sale.findUnique({
        where: { clientRef: input.clientRef },
        include: { items: true },
      });
      if (existing) return { sale: existing, deduped: true };
    }
    throw err;
  }
}

/**
 * Edita uma venda por completo (PDV-C). Antes de regravar:
 *  1) estorna o estoque dos itens antigos (StockMovement IN),
 *  2) remove o financeiro vinculado à venda (contas a receber),
 *  3) regrava itens + baixa de estoque e recalcula os totais,
 *  4) recria as formas de pagamento (split) e — se "A prazo" — as contas a receber.
 * Editar a venda sempre regenera o financeiro (financialGenerated = true).
 * Tudo em uma única transação para não deixar dados inconsistentes.
 */
export async function updateSale(saleId: string, input: UpdateSaleInput) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
    if (!old) throw new NotFoundError('Venda');

    // 1. Estorna o estoque dos itens antigos.
    for (const it of old.items) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stockQty: { increment: it.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: it.variantId, type: 'IN', quantity: it.quantity, reason: 'SALE_EDIT', refId: saleId },
      });
    }

    // 2. Remove o financeiro vinculado (contas a receber da venda).
    await tx.financialAccount.deleteMany({ where: { saleId } });

    // 3. Remove os itens e pagamentos antigos.
    await tx.saleItem.deleteMany({ where: { saleId } });
    await tx.salePayment.deleteMany({ where: { saleId } });

    // 4. Recalcula e regrava.
    const subtotal = sumItems(input.items);
    const discount = new Prisma.Decimal(input.discount ?? 0);
    const surcharge = new Prisma.Decimal(input.surcharge ?? 0);
    const total = subtotal.sub(discount).add(surcharge);
    if (total.lessThan(0)) throw new BusinessError('Desconto maior que o total da venda');

    // Formas de pagamento (default: pagamento único no valor total).
    const payments =
      input.payments && input.payments.length > 0
        ? input.payments
        : [{ method: input.paymentMethod, amount: total.toNumber() }];
    const cent = new Prisma.Decimal('0.01');
    const paidSum = payments.reduce((a, p) => a.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    if (paidSum.sub(total).abs().greaterThan(cent)) {
      throw new BusinessError('A soma das formas de pagamento difere do total da venda');
    }

    // Parte "A prazo" → gera contas a receber parceladas.
    const aPrazoTotal = payments
      .filter((p) => p.method === 'A_PRAZO')
      .reduce((a, p) => a.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    const installments = input.installments ?? [];
    if (aPrazoTotal.greaterThan(0)) {
      if (!input.clientId) throw new BusinessError('Venda a prazo exige um cliente');
      if (installments.length === 0) throw new BusinessError('Informe as parcelas da venda a prazo');
      const instSum = installments.reduce((a, i) => a.add(new Prisma.Decimal(i.amount)), new Prisma.Decimal(0));
      if (instSum.sub(aPrazoTotal).abs().greaterThan(cent)) {
        throw new BusinessError('A soma das parcelas difere do valor a prazo');
      }
    }

    for (const it of input.items) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stockQty: { decrement: it.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: it.variantId, type: 'OUT', quantity: -it.quantity, reason: 'SALE', refId: saleId },
      });
      await tx.saleItem.create({
        data: { saleId, variantId: it.variantId, quantity: it.quantity, unitPrice: it.unitPrice },
      });
    }

    // Contas a receber das parcelas a prazo.
    if (aPrazoTotal.greaterThan(0)) {
      await tx.financialAccount.createMany({
        data: installments.map((inst, i) => ({
          type: 'RECEIVABLE',
          description: `Venda a prazo ${i + 1}/${installments.length}`,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: 'PENDING',
          saleId,
          personId: input.clientId!,
        })),
      });
    }

    const legacyMethod = payments.length === 1 ? payments[0]!.method : 'SPLIT';

    return tx.sale.update({
      where: { id: saleId },
      data: {
        paymentMethod: legacyMethod,
        clientId: input.clientId ?? null,
        subtotal,
        discount,
        surcharge,
        totalAmount: total,
        notes: input.notes ?? null,
        financialGenerated: true,
        payments: { create: payments.map((p) => ({ method: p.method, amount: p.amount })) },
      },
      include: { items: true, payments: true },
    });
  });
}

/**
 * Exclui ou regenera o financeiro de uma venda (status "com/sem financeiro").
 *  - `generated = false`: a venda deixa de contar no caixa, nos recebimentos e
 *    no dashboard; as contas a receber vinculadas ficam ocultas. Bloqueado se
 *    houver título a receber já baixado (estorne antes).
 *  - `generated = true`: reverte, voltando a contar normalmente.
 */
export async function setSaleFinancialGenerated(saleId: string, generated: boolean) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { financialAccounts: { include: { settlements: true } } },
  });
  if (!sale) throw new NotFoundError('Venda');

  if (!generated) {
    const hasSettled = sale.financialAccounts.some(
      (a) => a.settlements.length > 0 || a.status !== 'PENDING',
    );
    if (hasSettled) {
      throw new BusinessError(
        'Há contas a receber desta venda com baixa registrada. Estorne as baixas antes de excluir o financeiro.',
      );
    }
  }

  return prisma.sale.update({
    where: { id: saleId },
    data: { financialGenerated: generated },
    include: { items: true, payments: true },
  });
}

/**
 * Exclui uma venda: estorna o estoque, remove o financeiro vinculado e apaga a
 * venda (itens em cascata). Operação atômica.
 */
export async function deleteSale(saleId: string) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: true } });
    if (!sale) throw new NotFoundError('Venda');

    for (const it of sale.items) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stockQty: { increment: it.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: it.variantId, type: 'IN', quantity: it.quantity, reason: 'SALE_DELETE', refId: saleId },
      });
    }

    await tx.financialAccount.deleteMany({ where: { saleId } });
    await tx.sale.delete({ where: { id: saleId } });
  });
}
