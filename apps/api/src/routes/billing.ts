import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { serializeDecimals } from '../lib/serialize.js';
import { NotFoundError } from '../lib/errors.js';
import { tenantDb } from '../lib/tenant.js';
import { computeBillingFlags } from '../lib/billing-guard.js';

/**
 * Faturamento SaaS — visão do TENANT (Pilar 2). Deliberadamente SOMENTE
 * LEITURA: emitir, baixar e cancelar fatura são operações exclusivas do Super
 * Admin (`routes/admin.ts`). Nenhum verbo de escrita é declarado aqui — o
 * `setNotFoundHandler` (plugins/error-handler.ts) devolve 404 JSON para
 * qualquer POST/PUT/PATCH/DELETE sob este prefixo, já que o fallback de SPA só
 * vale para GET fora de `/api`.
 *
 * A regra que deriva as flags (`computeBillingFlags`) nasceu aqui e foi movida
 * para `lib/billing-guard.ts` no Pilar 2b, quando a guarda de bloqueio real
 * virou o 2º consumidor — esta rota (consultiva) e a guarda (que recusa de
 * fato) precisam concordar sempre.
 */

export async function billingRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/billing/current — a fatura em aberto do próprio tenant + a
   * política de cobrança dele + as flags derivadas.
   */
  r.get('/current', { preHandler: app.authenticate }, async (req) => {
    const { db, companyId } = tenantDb(req);

    const [billing, company] = await Promise.all([
      // `companyId` é injetado pela extensão (TenantBilling está em
      // TENANT_SCOPED_MODELS) — impossível ler a fatura de outra empresa.
      // Vencimento mais antigo primeiro: é a que vence antes ou a que está
      // atrasada há mais tempo, que é justamente a que deve pautar o bloqueio.
      db.tenantBilling.findFirst({
        where: { status: 'PENDING' },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          amount: true,
          dueDate: true,
          pixPayload: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      // `Company` NÃO está em TENANT_SCOPED_MODELS (a extensão não injeta nada
      // aqui), então o id vai explícito — e vem do JWT (`tenantDb`), nunca do
      // body, o que mantém impossível ler a configuração de outra empresa.
      db.company.findFirst({
        where: { id: companyId },
        select: {
          billingReminderDays: true,
          billingBlockGraceDays: true,
          billingExempt: true,
        },
      }),
    ]);

    if (!company) throw new NotFoundError('Empresa');

    return {
      // `amount` é Decimal — precisa virar number antes de sair no JSON.
      billing: billing ? serializeDecimals(billing) : null,
      settings: company,
      flags: computeBillingFlags(billing?.dueDate ?? null, company),
    };
  });
}
