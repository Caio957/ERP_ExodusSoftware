import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  impersonateSchema,
  listCompaniesQuerySchema,
  updateCompanyStatusSchema,
  type JwtPayload,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { BusinessError, ForbiddenError, NotFoundError } from '../lib/errors.js';

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
}
