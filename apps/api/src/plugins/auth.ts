import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload, UserRole } from '@exodus/shared';
import { env } from '../env.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: exige um JWT válido. Popula `request.user`. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Factory de preHandler: exige autenticação + um dos papéis informados. */
    authorize: (
      roles: UserRole[],
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Plugin de autenticação: registra o @fastify/jwt e expõe os guards
 * `authenticate` e `authorize` para uso nas rotas (RBAC - Requisito 4.5).
 */
export const authPlugin = fp(async (app) => {
  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token ausente ou inválido');
    }
  });

  app.decorate('authorize', (roles: UserRole[]) => {
    return async (req: FastifyRequest) => {
      try {
        await req.jwtVerify();
      } catch {
        throw new UnauthorizedError('Token ausente ou inválido');
      }
      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError('Seu perfil não tem permissão para esta ação');
      }
    };
  });
});
