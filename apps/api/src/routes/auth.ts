import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createUserSchema, loginSchema, type JwtPayload } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import { tenantDb } from '../lib/tenant.js';

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
  // própria operação que descobre a quem o usuário pertence, então a busca
  // por e-mail precisa varrer todos os tenants (email é globalmente único).
  r.post('/login', { schema: { body: loginSchema } }, async (req) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

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
  r.get('/me', { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, allowedPages: true, companyId: true },
    });
    if (!user) throw new UnauthorizedError('Usuário não encontrado');
    return { ...req.user, allowedPages: user.allowedPages ?? null, companyId: user.companyId };
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
