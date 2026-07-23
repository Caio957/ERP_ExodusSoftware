import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { impersonateSchema, type JwtPayload } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

/**
 * Rotas administrativas globais (Exodus, dona do SaaS) — atravessam tenants
 * de propósito, então usam sempre o Prisma cru (nunca `withTenant`/
 * `tenantDb`: quem chama isto não pertence a UMA empresa, e `AuditLog` nem
 * está na lista de models escopados por tenant). Autorização por enquanto é
 * um bypass simples por e-mail (`SUPER_ADMIN_EMAIL`) até existir um
 * papel/painel de admin global de verdade (SYSTEM_ADMIN, Plano Mestre V2.0
 * §4) — ver nota em `env.ts` sobre por que essa variável é opcional.
 */
export async function adminRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

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
      // Bypass de autorização deliberadamente simples (ver env.ts): sem
      // SUPER_ADMIN_EMAIL configurada, ninguém passa (falha fechado).
      if (!env.SUPER_ADMIN_EMAIL || req.user.email !== env.SUPER_ADMIN_EMAIL) {
        throw new ForbiddenError('Você não tem permissão para acessar outras empresas.');
      }

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
}
