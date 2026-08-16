import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  impersonateSchema,
  listCompaniesQuerySchema,
  updateCompanyStatusSchema,
  createTenantBillingSchema,
  updateTenantBillingStatusSchema,
  updateCompanyBillingSettingsSchema,
  listTenantBillingsQuerySchema,
  type JwtPayload,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { BusinessError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { withEncryption } from '../lib/encryption.js';
import { serializeDecimals } from '../lib/serialize.js';

/**
 * Rotas administrativas globais (Exodus, dona do SaaS) — atravessam tenants
 * de propósito, então usam sempre o Prisma cru (nunca `withTenant`/
 * `tenantDb`: quem chama isto não pertence a UMA empresa, e `AuditLog`/
 * `Company` nem estão na lista de models escopados por tenant). Autorização
 * por enquanto é um bypass simples por e-mail (`SUPER_ADMIN_EMAIL`) até
 * existir um papel/painel de admin global de verdade (SYSTEM_ADMIN, Plano
 * Mestre V2.0 §4) — ver nota em `env.ts` sobre por que essa variável é
 * opcional.
 */
export async function adminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /**
   * Client para as rotas de FATURAMENTO. `TenantBilling.pixPayload` é cifrado
   * em repouso — usar o `prisma` cru aqui gravaria o PIX Copia e Cola em texto
   * claro no banco (falha silenciosa: a rota responderia 201 normalmente e só
   * apareceria ao inspecionar a tabela). Continua SEM `withTenant`: estas
   * rotas atravessam tenants de propósito (o Super Admin fatura todas as
   * lojas), e a autorização é o `assertSuperAdmin` de cada handler.
   */
  const db = withEncryption(prisma);

  /**
   * Guarda de super admin: bypass deliberadamente simples (ver env.ts). Sem
   * `SUPER_ADMIN_EMAIL` configurada, ninguém passa (falha fechado — nenhum
   * e-mail real é igual a `undefined`). Extraído para reuso entre todas as
   * rotas administrativas globais.
   */
  function assertSuperAdmin(req: FastifyRequest): void {
    if (!env.SUPER_ADMIN_EMAIL || req.user.email !== env.SUPER_ADMIN_EMAIL) {
      throw new ForbiddenError('Você não tem permissão para acessar o painel administrativo.');
    }
  }

  /**
   * POST /api/admin/impersonate — suporte técnico "entra" no tenant de um
   * cliente para dar suporte. Nunca mexe em dado de negócio do cliente por
   * aqui — só emite um token JWT escopado para a empresa-alvo, e deixa
   * rastro OBRIGATÓRIO em `AuditLog` antes de emitir o token (proteção
   * jurídica: toda sessão de impersonate fica registrada, sem exceção — se
   * o registro falhar, a troca de contexto também falha).
   */
  r.post(
    '/impersonate',
    { preHandler: app.authenticate, schema: { body: impersonateSchema } },
    async (req) => {
      assertSuperAdmin(req);

      const { targetCompanyId } = req.body;
      const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
      if (!company) throw new NotFoundError('Empresa');

      // Registro obrigatório ANTES de emitir o token — se a escrita de
      // auditoria falhar, a troca de contexto não acontece.
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            adminUserId: req.user.sub,
            targetCompanyId,
            action: 'IMPERSONATE_LOGIN',
          },
        });
      });

      // `sub`/`email`/`name` continuam identificando o admin REAL (é ele
      // quem está logado, só o `companyId` muda) — `withTenant`/`tenantDb`
      // só olham `req.user.companyId`, então isso já basta para "enganá-lo"
      // e escopar toda rota de negócio subsequente para o tenant-alvo.
      const payload: JwtPayload = {
        sub: req.user.sub,
        email: req.user.email,
        name: req.user.name,
        role: 'ADMIN',
        companyId: targetCompanyId,
        isImpersonating: true,
        originalUserId: req.user.sub,
      };
      const token = await r.jwt.sign(payload);

      return { token, company: { id: company.id, name: company.name } };
    },
  );

  /**
   * GET /api/admin/companies — painel de controle de contratos (Frente 1,
   * Missão 2). Lista as empresas (tenants) para triagem, com filtro opcional
   * por status. Inclui o(s) admin(s) de cada empresa (nome/e-mail) para o
   * operador da Exodus saber quem é o responsável antes de aprovar/rejeitar.
   */
  r.get(
    '/companies',
    { preHandler: app.authenticate, schema: { querystring: listCompaniesQuerySchema } },
    async (req) => {
      assertSuperAdmin(req);

      const { status } = req.query;
      const companies = await prisma.company.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          document: true,
          status: true,
          createdAt: true,
          // Política de cobrança (Faturamento SaaS): o painel precisa exibir o
          // valor ATUAL antes de deixar editar — em especial `billingExempt`,
          // que desliga o bloqueio por atraso. Sem isto o Super Admin editaria
          // às cegas e poderia sobrescrever uma carência customizada.
          billingReminderDays: true,
          billingBlockGraceDays: true,
          billingExempt: true,
          users: {
            where: { role: 'ADMIN' },
            select: { id: true, name: true, email: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      return companies;
    },
  );

  /**
   * PATCH /api/admin/companies/:id/status — aprovar/rejeitar/suspender/
   * reativar um tenant (o "controle de contratos"). Toda mudança fica
   * registrada em `AuditLog` ANTES de aplicar (mesma proteção jurídica do
   * impersonate — se a auditoria falhar, o status não muda). Salvaguarda:
   * o super admin não pode tirar a PRÓPRIA empresa de ACTIVE (se trancaria
   * fora do sistema, já que a guarda de login exige ACTIVE).
   */
  r.patch(
    '/companies/:id/status',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateCompanyStatusSchema,
      },
    },
    async (req) => {
      assertSuperAdmin(req);

      const { id } = req.params;
      const { status } = req.body;

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) throw new NotFoundError('Empresa');

      // Anti-autobloqueio: não deixa o super admin suspender/rejeitar a
      // própria empresa e se trancar fora (a guarda de login só deixa ACTIVE
      // entrar). Comparação por `companyId` do token do admin logado.
      if (id === req.user.companyId && status !== 'ACTIVE') {
        throw new BusinessError('Você não pode alterar o status da sua própria empresa para um estado que bloqueia o acesso.');
      }

      // Auditoria ANTES de aplicar (rastro jurídico do controle de contratos).
      // `action` codifica o status-alvo, reaproveitando o AuditLog existente
      // sem migração (ex.: 'COMPANY_STATUS_ACTIVE').
      const updated = await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            adminUserId: req.user.sub,
            targetCompanyId: id,
            action: `COMPANY_STATUS_${status}`,
          },
        });
        return tx.company.update({
          where: { id },
          data: { status },
          select: { id: true, name: true, document: true, status: true },
        });
      });

      return updated;
    },
  );

  // ==========================================================================
  // FATURAMENTO SAAS (Pilar 2) — mensalidade dos tenants
  // ==========================================================================
  // Todas usam `db` (= withEncryption(prisma), ver topo) sempre que tocam
  // `TenantBilling`, para o `pixPayload` ser cifrado na escrita e decifrado na
  // leitura de forma transparente. A rota de billing-settings mexe só em
  // `Company` (sem campo cifrado) e usa o `prisma` cru, igual à de status.

  /**
   * GET /api/admin/billing — lista faturas de mensalidade, com filtros
   * opcionais por empresa e status. Inclui os dados básicos do tenant para o
   * painel não precisar de um segundo round-trip. `pixPayload` vem decifrado:
   * é rota exclusiva do Super Admin, que precisa copiar/reenviar o PIX.
   */
  r.get(
    '/billing',
    { preHandler: app.authenticate, schema: { querystring: listTenantBillingsQuerySchema } },
    async (req) => {
      assertSuperAdmin(req);

      const { companyId, status } = req.query;
      const billings = await db.tenantBilling.findMany({
        where: { ...(companyId ? { companyId } : {}), ...(status ? { status } : {}) },
        // `createdAt` como desempate: duas faturas do mesmo vencimento saem
        // sempre na mesma ordem (grade estável no painel).
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          company: { select: { id: true, name: true, document: true, status: true } },
        },
        // Teto de segurança até o painel ter paginação (12 faturas por tenant
        // por ano — cresce sem limite se ninguém filtrar).
        take: 500,
      });
      // `amount` é Decimal — sem isto o JSON sai como objeto e quebra o front.
      return serializeDecimals(billings);
    },
  );

  /**
   * POST /api/admin/billing — emite uma fatura para um tenant. `status` não é
   * enviado: nasce 'PENDING' pelo `@default` do schema (Pilar 1).
   */
  r.post(
    '/billing',
    { preHandler: app.authenticate, schema: { body: createTenantBillingSchema } },
    async (req, reply) => {
      assertSuperAdmin(req);

      const { companyId, amount, dueDate, pixPayload } = req.body;
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) throw new NotFoundError('Empresa');

      // Auditoria ANTES de criar, na MESMA transação (mesmo padrão do
      // impersonate e do controle de contratos): se o rastro falhar, a fatura
      // não é emitida.
      const created = await db.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: { adminUserId: req.user.sub, targetCompanyId: companyId, action: 'BILLING_CREATE' },
        });
        return tx.tenantBilling.create({ data: { companyId, amount, dueDate, pixPayload } });
      });

      return reply.status(201).send(serializeDecimals(created));
    },
  );

  /**
   * PATCH /api/admin/billing/:id/status — baixa (PAID) ou cancela (CANCELLED).
   * Só sai de PENDING: reemitir/"despagar" uma fatura não é operação prevista
   * (emita outra fatura em vez disso).
   */
  r.patch(
    '/billing/:id/status',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateTenantBillingStatusSchema,
      },
    },
    async (req) => {
      assertSuperAdmin(req);

      const { id } = req.params;
      const { status } = req.body;

      // `select` sem `pixPayload`: não há motivo para decifrar o PIX só para
      // mudar o status (o campo computado da extensão só roda quando é
      // selecionado).
      const billing = await db.tenantBilling.findUnique({
        where: { id },
        select: { id: true, companyId: true, status: true },
      });
      if (!billing) throw new NotFoundError('Fatura');
      if (billing.status !== 'PENDING') {
        throw new BusinessError(
          `Esta fatura já está ${billing.status === 'PAID' ? 'paga' : 'cancelada'} e não pode mudar de status.`,
        );
      }

      const updated = await db.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            adminUserId: req.user.sub,
            targetCompanyId: billing.companyId,
            action: `BILLING_STATUS_${status}`,
          },
        });
        return tx.tenantBilling.update({
          where: { id },
          // Cancelamento não é pagamento: `paidAt` só é carimbado no PAID.
          data: { status, paidAt: status === 'PAID' ? new Date() : null },
        });
      });

      return serializeDecimals(updated);
    },
  );

  /**
   * PATCH /api/admin/companies/:id/billing-settings — política de cobrança do
   * tenant (aviso prévio, carência antes do bloqueio e isenção). Usa o
   * `prisma` cru: `Company` não tem campo cifrado.
   */
  r.patch(
    '/companies/:id/billing-settings',
    {
      preHandler: app.authenticate,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateCompanyBillingSettingsSchema,
      },
    },
    async (req) => {
      assertSuperAdmin(req);

      const { id } = req.params;
      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) throw new NotFoundError('Empresa');

      const updated = await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: { adminUserId: req.user.sub, targetCompanyId: id, action: 'BILLING_SETTINGS_UPDATE' },
        });
        // `billingExempt` é a chave-mestra que desliga o bloqueio por atraso —
        // a decisão de contrato mais sensível deste módulo. Como `AuditLog` só
        // tem `action` (sem coluna de metadados), um segundo registro com ação
        // própria é o que torna "quem isentou o tenant X e quando" greppável,
        // em vez de ficar escondido dentro de um genérico SETTINGS_UPDATE.
        if (req.body.billingExempt !== undefined) {
          await tx.auditLog.create({
            data: {
              adminUserId: req.user.sub,
              targetCompanyId: id,
              action: req.body.billingExempt ? 'BILLING_EXEMPT_ON' : 'BILLING_EXEMPT_OFF',
            },
          });
        }
        return tx.company.update({
          where: { id },
          // O `.refine()` do schema já garante ao menos um campo presente.
          data: req.body,
          select: {
            id: true,
            name: true,
            billingReminderDays: true,
            billingBlockGraceDays: true,
            billingExempt: true,
          },
        });
      });

      return updated;
    },
  );
}
