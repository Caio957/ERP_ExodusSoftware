import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createUserSchema, loginSchema, type JwtPayload } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { UnauthorizedError } from '../lib/errors.js';

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

  // GET /api/auth/me
  r.get('/me', { preHandler: app.authenticate }, async (req) => req.user);
}
