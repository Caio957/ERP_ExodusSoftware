import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

/**
 * Hook global de tratamento de exceções (Requisito 4.8).
 * Captura QUALQUER erro não tratado, registra rota + payload + erro exato
 * e devolve uma resposta JSON padronizada — sem vazar stack em produção.
 */
/**
 * Campos que NUNCA podem chegar ao log, mesmo em erro. `pixPayload` (PIX Copia
 * e Cola de uma fatura de mensalidade) é cifrado em repouso pela extensão
 * `withEncryption` — logar o corpo cru de um `POST /admin/billing` que falhou
 * gravaria exatamente esse dado em texto claro no stream de logs do Railway,
 * anulando a criptografia. `password` entra pela mesma razão (onboarding e
 * criação de usuário trafegam a senha em claro no corpo).
 */
const SENSITIVE_BODY_FIELDS = ['pixPayload', 'password'] as const;

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const source = body as Record<string, unknown>;
  let redacted: Record<string, unknown> | null = null;
  for (const field of SENSITIVE_BODY_FIELDS) {
    if (field in source) {
      redacted ??= { ...source };
      redacted[field] = '[REDACTED]';
    }
  }
  // Sem campo sensível, devolve o objeto original (não paga cópia à toa).
  return redacted ?? body;
}

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((error, request, reply) => {
    const base = {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
      body: redactBody(request.body),
    };

    // 1. Erros de validação (Zod via fastify-type-provider-zod)
    if (hasZodFastifySchemaValidationErrors(error)) {
      request.log.warn({ ...base, validation: error.validation }, 'Falha de validação');
      return reply.status(400).send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        issues: error.validation,
      });
    }

    // 2. ZodError lançado manualmente (ex.: dentro de um service)
    if (error instanceof ZodError) {
      request.log.warn({ ...base, issues: error.issues }, 'Falha de validação (Zod)');
      return reply.status(400).send({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        issues: error.issues,
      });
    }

    // 3. Erros de aplicação conhecidos
    if (error instanceof AppError) {
      request.log.info({ ...base, code: error.code }, error.message);
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }

    // 4. Erros conhecidos do Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // `companyId` some da mensagem exibida ao usuário: desde que as
        // constraints viraram compostas por tenant (Plano Mestre V2.0 —
        // constraints globais → tenant-scoped), toda violação de unicidade
        // inclui esse campo no `target` do Prisma, mas ele não tem nenhum
        // significado pro operador ("Registro já existe (companyId, sku)"
        // é ruído — "(sku)" já basta).
        const target = (error.meta?.target as string[] | undefined)
          ?.filter((field) => field !== 'companyId')
          .join(', ');
        request.log.warn({ ...base, prisma: error.code }, 'Violação de unicidade');
        return reply.status(409).send({
          statusCode: 409,
          code: 'UNIQUE_CONSTRAINT',
          message: `Registro já existe${target ? ` (${target})` : ''}`,
        });
      }
      if (error.code === 'P2025') {
        return reply.status(404).send({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Registro não encontrado',
        });
      }
    }

    // 5. Erro inesperado — loga TUDO para manutenção técnica
    request.log.error({ ...base, err: error }, 'Erro não tratado');
    const isProd = process.env.NODE_ENV === 'production';
    const err = error as { statusCode?: number; message?: string };
    const status = err.statusCode ?? 500;
    return reply.status(status).send({
      statusCode: status,
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Erro interno do servidor' : err.message ?? 'Erro interno',
    });
  });

  // Rota não encontrada
  app.setNotFoundHandler((request, reply) => {
    /**
     * SPA fallback (monolito): se @fastify/static estiver ativo (produção) e a
     * requisição for navegação do front (GET fora de /api), devolve o index.html
     * para o React Router resolver a rota no cliente. APIs continuam com 404 JSON.
     */
    const sendFile = (reply as { sendFile?: (path: string) => unknown }).sendFile;
    const isApiPath = request.url.startsWith('/api') || request.url === '/health';
    if (!isApiPath && request.method === 'GET' && typeof sendFile === 'function') {
      return reply.sendFile('index.html');
    }

    reply.status(404).send({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: `Rota ${request.method} ${request.url} não existe`,
    });
  });
});
