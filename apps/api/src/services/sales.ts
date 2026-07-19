import type { CreateSaleInput, UpdateSaleInput, CashRegisterType } from '@exodus/shared';
import { Prisma } from '@prisma/client';
import { AppError, BusinessError, NotFoundError } from '../lib/errors.js';
import type { TenantClient } from '../lib/tenant.js';

/** Soma os itens (subtotal bruto). */
function sumItems(items: { unitPrice: number; quantity: number }[]) {
  return items.reduce(
    (acc, it) => acc.add(new Prisma.Decimal(it.unitPrice).mul(it.quantity)),
    new Prisma.Decimal(0),
  );
}

/** Confere que todos os variantId do carrinho pertencem ao tenant (fecha um
 * IDOR real: sem essa checagem, um payload malicioso poderia referenciar
 * `variantId` de OUTRA empresa e decrementar o estoque dela). */
async function assertVariantsBelongToTenant(db: TenantClient, variantIds: string[]) {
  const unique = [...new Set(variantIds)];
  const found = await db.productVariant.findMany({ where: { id: { in: unique } } });
  if (found.length !== unique.length) throw new NotFoundError('Produto');
}

/**
 * Cria uma venda de forma idempotente e atômica.
 *  - O total é recalculado no servidor (não confia no cliente).
 *  - Baixa o estoque e registra o razão (StockMovement OUT).
 *  - Se `clientRef` já existir, retorna a venda existente (evita duplicar na
 *    sincronização da fila offline - Requisito 4.4).
 */
export async function createSale(
  db: TenantClient,
  companyId: string,
  input: CreateSaleInput,
  userId: string,
) {
  // Idempotência: venda já sincronizada anteriormente.
  if (input.clientRef) {
    const existing = await db.sale.findFirst({
      where: { clientRef: input.clientRef },
      include: { items: true },
    });
    if (existing) return { sale: existing, deduped: true };
  }

  const register = await db.cashRegister.findFirst({
    where: { id: input.cashRegisterId },
  });
  if (!register) throw new NotFoundError('Caixa');
  if (register.status !== 'OPEN') throw new BusinessError('Caixa não está aberto');

  await assertVariantsBelongToTenant(db, input.items.map((it) => it.variantId));

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
    const sale = await db.$transaction(async (tx) => {
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
          companyId,
          items: {
            create: input.items.map((it) => ({
              variantId: it.variantId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              companyId,
            })),
          },
          payments: {
            create: payments.map((p) => ({ method: p.method, amount: p.amount, companyId })),
          },
        },
        include: { items: true, payments: true },
      });

      // Contas a receber das parcelas a prazo.
      if (aPrazoTotal.greaterThan(0)) {
        await tx.financialAccount.createMany({
          data: installments.map((inst, i) => ({
            type: 'RECEIVABLE',
            description: `Venda #${created.code} - Parcela ${i + 1}/${installments.length}`,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: 'PENDING',
            saleId: created.id,
            personId: input.clientId!,
            companyId,
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
            companyId,
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
      const existing = await db.sale.findFirst({
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
 * Editar a venda sempre regenera o financeiro (financialGenerated = true). Se
 * `input.targetRegisterType` for informado, a venda também é realocada para o
 * caixa aberto daquele tipo (DIARIO/BANCO) do usuário logado (`userId`) —
 * mesmo mecanismo de `setSaleFinancialGenerated`, usado aqui pelo Mini-PDV de
 * edição (`EditSaleModal`, sempre recria o financeiro ao salvar).
 * Tudo em uma única transação para não deixar dados inconsistentes.
 */
export async function updateSale(
  db: TenantClient,
  companyId: string,
  saleId: string,
  input: UpdateSaleInput,
  userId: string,
) {
  await assertVariantsBelongToTenant(db, input.items.map((it) => it.variantId));

  return db.$transaction(async (tx) => {
    const old = await tx.sale.findFirst({ where: { id: saleId }, include: { items: true } });
    if (!old) throw new NotFoundError('Venda');

    let cashRegisterId: string | undefined;
    if (input.targetRegisterType) {
      const targetRegister = await tx.cashRegister.findFirst({
        where: { userId, status: 'OPEN', type: input.targetRegisterType },
      });
      if (!targetRegister) {
        throw new AppError(
          400,
          `Não há um caixa ${input.targetRegisterType === 'DIARIO' ? 'Físico' : 'Conta Banco'} aberto para o usuário logado.`,
        );
      }
      cashRegisterId = targetRegister.id;
    }

    // 1. Estorna o estoque dos itens antigos.
    for (const it of old.items) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stockQty: { increment: it.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: it.variantId,
          type: 'IN',
          quantity: it.quantity,
          reason: 'SALE_EDIT',
          refId: saleId,
          companyId,
        },
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
        data: {
          variantId: it.variantId,
          type: 'OUT',
          quantity: -it.quantity,
          reason: 'SALE',
          refId: saleId,
          companyId,
        },
      });
      await tx.saleItem.create({
        data: { saleId, variantId: it.variantId, quantity: it.quantity, unitPrice: it.unitPrice, companyId },
      });
    }

    // Contas a receber das parcelas a prazo.
    if (aPrazoTotal.greaterThan(0)) {
      await tx.financialAccount.createMany({
        data: installments.map((inst, i) => ({
          type: 'RECEIVABLE',
          description: `Venda #${old.code} - Parcela ${i + 1}/${installments.length}`,
          amount: inst.amount,
          dueDate: inst.dueDate,
          status: 'PENDING',
          saleId,
          personId: input.clientId!,
          companyId,
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
        ...(cashRegisterId ? { cashRegisterId } : {}),
        payments: { create: payments.map((p) => ({ method: p.method, amount: p.amount, companyId })) },
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
 *  - `generated = true`: reverte, voltando a contar normalmente. Se
 *    `targetRegisterType` for informado, a venda é realocada para o caixa
 *    aberto daquele tipo (DIARIO/BANCO) do usuário logado (`userId`) — o
 *    lançamento some da timeline do caixa antigo e passa a aparecer no novo,
 *    já que `computeExpectedCash`/`/movements`/`/report` (routes/cash.ts)
 *    escopam tudo por `Sale.cashRegisterId`. `SalePayment` não referencia
 *    caixa nenhum (só `saleId`), então mover o `cashRegisterId` da venda é
 *    suficiente — não há "pagamentos" para recriar.
 */
export async function setSaleFinancialGenerated(
  db: TenantClient,
  saleId: string,
  generated: boolean,
  options?: { userId: string; targetRegisterType?: CashRegisterType },
) {
  const sale = await db.sale.findFirst({
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

  const targetRegisterType = generated ? options?.targetRegisterType : undefined;

  return db.$transaction(async (tx) => {
    let cashRegisterId: string | undefined;
    if (targetRegisterType && options) {
      const targetRegister = await tx.cashRegister.findFirst({
        where: { userId: options.userId, status: 'OPEN', type: targetRegisterType },
      });
      if (!targetRegister) {
        throw new AppError(
          400,
          `Não há um caixa ${targetRegisterType === 'DIARIO' ? 'Físico' : 'Conta Banco'} aberto para o usuário logado.`,
        );
      }
      cashRegisterId = targetRegister.id;
    }

    return tx.sale.update({
      where: { id: saleId },
      data: { financialGenerated: generated, ...(cashRegisterId ? { cashRegisterId } : {}) },
      include: { items: true, payments: true },
    });
  });
}

/**
 * Exclui uma venda: estorna o estoque, remove o financeiro vinculado e apaga a
 * venda (itens em cascata). Operação atômica.
 */
export async function deleteSale(db: TenantClient, saleId: string, companyId: string) {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id: saleId }, include: { items: true } });
    if (!sale) throw new NotFoundError('Venda');

    for (const it of sale.items) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: { stockQty: { increment: it.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          variantId: it.variantId,
          type: 'IN',
          quantity: it.quantity,
          reason: 'SALE_DELETE',
          refId: saleId,
          companyId,
        },
      });
    }

    await tx.financialAccount.deleteMany({ where: { saleId } });
    await tx.sale.delete({ where: { id: saleId } });
  });
}
