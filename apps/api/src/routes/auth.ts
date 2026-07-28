import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createUserSchema, loginSchema, type JwtPayload, type LoginNeedsCompany } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import { tenantDb } from '../lib/tenant.js';
import { env } from '../env.js';

const idParam = z.object({ id: z.string().uuid() });

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'CASHIER']).optional(),
  allowedPages: z.array(z.string()).nullable().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/auth/login — deliberadamente NÃO escopado por tenant: login é a
  // própria operação que descobre a quem o usuário pertence. User.email
  // deixou de ser globalmente único (Plano Mestre V2.0 — constraints globais
  // → tenant-scoped: o mesmo e-mail pode pertencer a contas em empresas
  // diferentes, ex.: contador/franqueado). Busca TODAS as contas com esse
  // e-mail; se o cliente já informou `companyId` (reenvio pós-desambiguação),
  // restringe antes de validar senha — como email é único DENTRO de uma
  // empresa (@@unique([companyId, email])), isso já garante no máximo 1
  // candidato.
  r.post('/login', { schema: { body: loginSchema } }, async (req) => {
    const { email, password, companyId } = req.body;

    const candidates = await prisma.user.findMany({
      where: { email, ...(companyId ? { companyId } : {}) },
      // Status da empresa: guarda de onboarding (Frente 1) — só empresas
      // ACTIVE podem logar. `companyId` null (futuro SYSTEM_ADMIN global) não
      // tem empresa e passa direto.
      include: { company: { select: { status: true } } },
    });

    // Valida a senha contra cada candidato ANTES de decidir qualquer coisa
    // sobre desambiguação — nunca revela quais/quantas empresas têm conta
    // com esse e-mail para quem não provou conhecer a senha (evita
    // enumeration de contas).
    const matches: typeof candidates = [];
    for (const candidate of candidates) {
      if (await verifyPassword(password, candidate.passwordHash)) matches.push(candidate);
    }

    if (matches.length === 0) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    // Guarda de status da empresa (onboarding — Frente 1): a senha já foi
    // validada acima, então aqui já é seguro revelar o estado da conta. Só
    // contas cuja empresa está ACTIVE (ou sem empresa — SYSTEM_ADMIN futuro)
    // seguem no fluxo. Empresas PENDING/REJECTED/BLOCKED são barradas com um
    // `code` próprio (COMPANY_NOT_ACTIVE) e mensagem amigável — diferente do
    // NO_TENANT, não dispara logout automático no frontend (login nem tem
    // token ainda), só exibe o aviso na tela.
    const activeMatches = matches.filter((m) => !m.company || m.company.status === 'ACTIVE');
    if (activeMatches.length === 0) {
      const anyPending = matches.some((m) => m.company?.status === 'PENDING');
      throw new ForbiddenError(
        anyPending
          ? 'Sua empresa está aguardando aprovação da equipe Exodus.'
          : 'O acesso desta empresa está indisponível. Fale com o suporte Exodus.',
        'COMPANY_NOT_ACTIVE',
      );
    }

    // Mais de uma empresa com o mesmo e-mail + mesma senha — caso raro
    // (contador/franqueado com acesso a várias lojas usando a mesma senha
    // em ambas). Só é possível chegar aqui sem `companyId` no body (com ele,
    // `candidates` já vem restrito a no máximo 1 pela unicidade composta).
    // Sem token ainda: o frontend mostra um seletor e reenvia o login com
    // `companyId` preenchido.
    if (activeMatches.length > 1) {
      const companyIds = activeMatches
        .map((m) => m.companyId)
        .filter((id): id is string => id != null);
      const companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });
      return { needsCompanySelection: true, companies } satisfies LoginNeedsCompany;
    }

    const user = activeMatches[0]!;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as JwtPayload['role'],
      companyId: user.companyId,
    };
    const token = await r.jwt.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  });

  // POST /api/auth/register (apenas ADMIN cria novos usuários — sempre no
  // mesmo tenant de quem está criando).
  r.post(
    '/register',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createUserSchema } },
    async (req, reply) => {
      const { name, email, password, role } = req.body;
      const { db, companyId } = tenantDb(req);
      const user = await db.user.create({
        data: { name, email, role, passwordHash: await hashPassword(password), companyId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      return reply.status(201).send(user);
    },
  );

  // GET /api/auth/me — retorna dados do usuário logado incluindo allowedPages
  // e companyId sempre lidos frescos do banco (não confia na claim do JWT,
  // que pode ter até 12h — mesmo raciocínio já aplicado a allowedPages).
  // Deliberadamente NÃO usa tenantDb/withTenant: é o próprio usuário lendo o
  // próprio registro por `id` (nenhum risco de IDOR), e precisa continuar
  // funcionando mesmo para um futuro usuário global (companyId null).
  //
  // `isSuperAdmin`: mesmo raciocínio de "sempre fresco" — nunca gravado no
  // JWT (evitaria refletir uma troca de SUPER_ADMIN_EMAIL só depois de até
  // 12h) e nunca expõe o valor da env var em si, só o resultado do
  // comparativo. É puramente um sinal de UX para o frontend decidir se
  // mostra a entrada do Back-Office — a autorização de verdade continua
  // sendo `assertSuperAdmin` no backend (routes/admin.ts), reavaliada a cada
  // chamada real às rotas administrativas.
  r.get('/me', { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, allowedPages: true, companyId: true },
    });
    if (!user) throw new UnauthorizedError('Usuário não encontrado');
    const isSuperAdmin = !!env.SUPER_ADMIN_EMAIL && user.email === env.SUPER_ADMIN_EMAIL;
    return { ...req.user, allowedPages: user.allowedPages ?? null, companyId: user.companyId, isSuperAdmin };
  });

  // GET /api/auth/users — lista usuários do próprio tenant (ADMIN)
  r.get('/users', { preHandler: app.authorize(['ADMIN']) }, async (req) => {
    const { db } = tenantDb(req);
    return db.user.findMany({
      select: { id: true, name: true, email: true, role: true, allowedPages: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  // PUT /api/auth/users/:id — edita usuário (ADMIN, só do próprio tenant)
  r.put(
    '/users/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: updateUserSchema } },
    async (req) => {
      const { id } = req.params;
      const { name, email, password, role, allowedPages } = req.body;
      const { db } = tenantDb(req);

      const existing = await db.user.findFirst({ where: { id } });
      if (!existing) throw new NotFoundError('Usuário');

      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (role !== undefined) data.role = role;
      if (allowedPages !== undefined) data.allowedPages = allowedPages;
      if (password) data.passwordHash = await hashPassword(password);

      const user = await db.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, allowedPages: true },
      });
      return user;
    },
  );

  // DELETE /api/auth/users/:id — exclui usuário (ADMIN, não pode excluir a si
  // mesmo, só do próprio tenant)
  r.delete(
    '/users/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req) => {
      const { id } = req.params;
      if (id === req.user.sub) {
        throw new AppError(400, 'Você não pode excluir seu próprio usuário.', 'SELF_DELETE');
      }
      const { db } = tenantDb(req);
      const existing = await db.user.findFirst({ where: { id } });
      if (!existing) throw new NotFoundError('Usuário');
      await db.user.delete({ where: { id } });
      return { success: true };
    },
  );
}
