import { prisma } from './prisma.js';
import { diffDaysBr } from './dates.js';

/**
 * Regra de inadimplência do Faturamento SaaS — FONTE ÚNICA.
 *
 * Nasceu privada em `routes/billing.ts` (Pilar 2), servindo só a resposta
 * consultiva de `GET /api/billing/current`. Ao surgir o 2º consumidor — a
 * guarda de bloqueio real (`plugins/billing-guard.ts`, Pilar 2b) — foi extraída
 * para cá, mesmo precedente de `calcWeightedAverageCost` (lib/inventory.ts),
 * `apportionLandedCost` (shared/pricing.ts) e `todayStartBr` (lib/dates.ts).
 *
 * Duplicar a regra seria a pior divergência possível neste módulo: a tela
 * dizendo "em dia" enquanto a API bloqueia o lojista (ou o contrário, que é
 * pior ainda — bloqueio que não bloqueia).
 */

export interface BillingSettings {
  billingReminderDays: number;
  billingBlockGraceDays: number;
  billingExempt: boolean;
}

/**
 * Nomeado `BillingFlags`, e não `TenantBillingStatus`: esse nome já pertence ao
 * `z.enum(['PENDING','PAID','CANCELLED'])` do `@exodus/shared`, e a colisão
 * confundiria qualquer arquivo que importe os dois.
 */
export interface BillingFlags {
  shouldShowReminder: boolean;
  isOverdue: boolean;
  isBlocked: boolean;
  daysUntilDue: number | null;
  daysOverdue: number;
}

/**
 * Sinais derivados de uma fatura em aberto. Função PURA (sem I/O) — a mesma
 * regra alimenta a resposta consultiva de `/billing/current` (Pilar 3 usa para
 * decidir entre não mostrar nada, avisar ou bloquear a tela) e o `preHandler`
 * que recusa de fato as rotas de negócio.
 *
 * `daysUntilDue`/`daysOverdue` acompanham as flags de propósito: sem eles, o
 * frontend teria que refazer aritmética de fuso para escrever "vence em 3
 * dias", que é exatamente o cálculo que centralizamos no servidor.
 */
export function computeBillingFlags(dueDate: Date | null, settings: BillingSettings): BillingFlags {
  // Sem fatura em aberto não há o que avisar nem o que bloquear.
  if (!dueDate) {
    return {
      shouldShowReminder: false,
      isOverdue: false,
      isBlocked: false,
      daysUntilDue: null,
      daysOverdue: 0,
    };
  }

  // Positivo = faltam N dias · 0 = vence hoje · negativo = venceu há N dias.
  const daysUntilDue = diffDaysBr(dueDate);
  const isOverdue = daysUntilDue < 0;
  const daysOverdue = isOverdue ? -daysUntilDue : 0;

  return {
    // Janela de cortesia ANTES do vencimento (inclui o próprio dia: 0).
    shouldShowReminder: !isOverdue && daysUntilDue <= settings.billingReminderDays,
    isOverdue,
    // `>` e não `>=`: com carência 3, só bloqueia no 4º dia de atraso.
    // `billingExempt` neutraliza SÓ o bloqueio — o lojista isento continua
    // vendo que está em atraso, mas nunca perde o acesso.
    isBlocked: isOverdue && daysOverdue > settings.billingBlockGraceDays && !settings.billingExempt,
    daysUntilDue,
    daysOverdue,
  };
}

/** Empresa inexistente/sem fatura: nada a avisar, nada a bloquear. */
const NEUTRAL_SETTINGS: BillingSettings = {
  billingReminderDays: 0,
  billingBlockGraceDays: 0,
  billingExempt: false,
};

/**
 * Situação de cobrança de um tenant, direto do banco. Chamada pela guarda em
 * TODA requisição autenticada a rota de negócio, então é deliberadamente
 * enxuta: um único round-trip.
 *
 * Usa o `prisma` CRU com `companyId` explícito no `where` — não `withTenant`.
 * O isolamento é o mesmo (o `companyId` vem do JWT já verificado, nunca do
 * corpo da requisição), mas sem alocar duas extensões de Prisma
 * (`withEncryption` + `withTenant`) a cada request do sistema inteiro. Nenhum
 * campo cifrado é selecionado aqui (só `dueDate`), então `withEncryption`
 * também não teria o que fazer.
 *
 * ⚠️ Erro de banco NÃO é capturado de propósito: a exceção sobe e a requisição
 * morre em 500 — que é o comportamento *fail-closed* correto. Engolir a falha e
 * devolver `isBlocked: false` transformaria uma instabilidade de banco em
 * liberação geral de acesso.
 *
 * Sem cache nesta versão (decisão consciente): é um `findUnique` com relação
 * aninhada `take: 1`. Se o volume de requisições crescer, o ponto natural de
 * otimização é um cache em memória curto (30–60s) por `companyId`.
 */
export async function getTenantBillingStatus(
  companyId: string,
): Promise<BillingFlags & { dueDate: Date | null }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingReminderDays: true,
      billingBlockGraceDays: true,
      billingExempt: true,
      // A fatura em aberto MAIS ANTIGA é a que vence primeiro / está atrasada
      // há mais tempo — é ela que pauta o bloqueio.
      tenantBillings: {
        where: { status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { dueDate: true },
      },
    },
  });

  const dueDate = company?.tenantBillings[0]?.dueDate ?? null;
  return {
    ...computeBillingFlags(dueDate, company ?? NEUTRAL_SETTINGS),
    dueDate,
  };
}
