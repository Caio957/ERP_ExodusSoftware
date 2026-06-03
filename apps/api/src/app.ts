import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
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

  /**
   * Monolito (deploy Railway): a própria API serve o PWA já compilado.
   * Quando WEB_DIST aponta para o build do front (apps/web/dist), os assets
   * são servidos estaticamente e as rotas de navegação do SPA caem no
   * fallback de index.html definido no error-handler (notFoundHandler).
   */
  const webDist = process.env.WEB_DIST;
  if (webDist && existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
    app.log.info(`🖥️  Servindo PWA estático de ${webDist}`);
  }

  return app;
}

export type AppInstance = ReturnType<typeof buildApp>;
