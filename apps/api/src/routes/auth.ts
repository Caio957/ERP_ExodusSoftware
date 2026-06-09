import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createUserSchema, loginSchema, type JwtPayload } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError, NotFoundError, UnauthorizedError } from '../lib/errors.js';

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

  // POST /api/auth/login
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
    };
    const token = await r.jwt.sign(payload);

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  });

  // POST /api/auth/register (apenas ADMIN cria novos usuários)
  r.post(
    '/register',
    { preHandler: app.authorize(['ADMIN']), schema: { body: createUserSchema } },
    async (req, reply) => {
      const { name, email, password, role } = req.body;
      const user = await prisma.user.create({
        data: { name, email, role, passwordHash: await hashPassword(password) },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      return reply.status(201).send(user);
    },
  );

  // GET /api/auth/me — retorna dados do usuário logado incluindo allowedPages
  r.get('/me', { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, allowedPages: true },
    });
    if (!user) throw new UnauthorizedError('Usuário não encontrado');
    return { ...req.user, allowedPages: user.allowedPages ?? null };
  });

  // GET /api/auth/users — lista todos os usuários (ADMIN)
  r.get('/users', { preHandler: app.authorize(['ADMIN']) }, async () => {
    return prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, allowedPages: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  // PUT /api/auth/users/:id — edita usuário (ADMIN)
  r.put(
    '/users/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam, body: updateUserSchema } },
    async (req) => {
      const { id } = req.params;
      const { name, email, password, role, allowedPages } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (role !== undefined) data.role = role;
      if (allowedPages !== undefined) data.allowedPages = allowedPages;
      if (password) data.passwordHash = await hashPassword(password);

      const user = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, allowedPages: true },
      });
      return user;
    },
  );

  // DELETE /api/auth/users/:id — exclui usuário (ADMIN, não pode excluir a si mesmo)
  r.delete(
    '/users/:id',
    { preHandler: app.authorize(['ADMIN']), schema: { params: idParam } },
    async (req) => {
      const { id } = req.params;
      if (id === req.user.sub) {
        throw new AppError(400, 'Você não pode excluir seu próprio usuário.', 'SELF_DELETE');
      }
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError('Usuário');
      await prisma.user.delete({ where: { id } });
      return { success: true };
    },
  );
}
