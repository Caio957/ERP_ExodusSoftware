import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { registerRoutes } from './routes/index.js';

export function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: 'info',
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : { level: 'info' },
  }).withTypeProvider<ZodTypeProvider>();

  // Validação e serialização baseadas em Zod em todas as rotas.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Segurança e CORS
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Infra: tratamento global de erros + autenticação/RBAC
  app.register(errorHandlerPlugin);
  app.register(authPlugin);

  // Healthcheck
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Rotas de negócio sob /api
  app.register(registerRoutes, { prefix: '/api' });

  return app;
}

export type AppInstance = ReturnType<typeof buildApp>;
