import type { FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';
import { ForbiddenError } from './errors.js';
import { withEncryption } from './encryption.js';

// Modelos que carregam `companyId` (Fase 1 do Plano Mestre Multi-Tenant —
// ver o cabeçalho de schema.prisma). Mantido como lista explícita (não
// introspecção em runtime) para ficar óbvio, em revisão de código, quais
// modelos esta extensão realmente escopa.
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Product',
  'ProductVariant',
  'Person',
  'Invoice',
  'InvoiceItem',
  'SupplierProductMapping',
  'CashRegister',
  'CashTransaction',
  'Sale',
  'SaleItem',
  'SalePayment',
  'StockMovement',
  'Setting',
  'FinancialAccount',
  'AccountSettlement',
]);

// Operações em que dá para injetar `companyId` de forma segura e direta no
// `where` — filtram/afetam várias linhas, não dependem de um seletor único.
const SCOPED_WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * Base da "RLS lógica" descrita no Plano Mestre V2.0 (§3 — Blindagem do
 * Motor de Isolamento). Retorna um PrismaClient estendido, escopado a UMA
 * empresa: toda leitura/atualização em massa ganha `{ companyId }` forçado
 * no `where`, e toda criação ganha `{ companyId }` forçado no `data` — o
 * chamador nunca precisa (e não deve) escrever `companyId` manualmente nas
 * queries. `$transaction` chamado sobre o client retornado também propaga a
 * extensão para o `tx` recebido no callback (comportamento nativo do Prisma
 * Client Extensions).
 *
 * ⚠️ Limitação conhecida e deliberada: operações por seletor único
 * (`findUnique`, `findUniqueOrThrow`, `update`, `delete`, `upsert`) NÃO são
 * escopadas aqui — o Prisma não aceita mesclar um campo arbitrário no
 * `where` de um seletor `@id`/`@unique` sem quebrar a tipagem gerada. Cada
 * rota que usava essas operações foi refatorada (Fase 4) para `findFirst`
 * (a extensão injeta `companyId` normalmente) ou, quando havia uma escrita
 * por id único, para buscar com `findFirst` + validar posse antes de agir —
 * mesmo padrão que `GET /sales/:id` já usava para isolamento RBAC entre
 * ADMIN/CASHIER antes de existir multi-tenant.
 */
/** Tipo do client retornado por `withTenant`/`tenantDb` — reutilizado por
 * funções de serviço (ex.: services/sales.ts) que recebem o client já
 * escopado em vez de acessar `req` diretamente. */
export type TenantClient = ReturnType<typeof withTenant>;

export function withTenant(companyId: string) {
  if (!companyId) {
    throw new Error('withTenant: companyId é obrigatório para escopar o client por tenant');
  }

  // Composição de extensões: withEncryption (Plano Mestre V2.0, Frente 2 —
  // lib/encryption.ts) primeiro, withTenant por cima — o `tx` de um
  // `db.$transaction()` chamado sobre o client resultante propaga as DUAS
  // extensões (comportamento nativo do Prisma Client Extensions), então
  // qualquer rota que já usa `tenantDb(req)` para tocar em `Person` passa a
  // gravar/ler criptografado sem precisar saber disso.
  return withEncryption(prisma).$extends({
    name: 'withTenant',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (SCOPED_WHERE_OPS.has(operation)) {
            const scoped = args as { where?: Record<string, unknown> };
            scoped.where = { ...scoped.where, companyId };
          } else if (operation === 'create') {
            const scoped = args as { data?: Record<string, unknown> };
            scoped.data = { ...scoped.data, companyId };
          } else if (operation === 'createMany') {
            const scoped = args as {
              data?: Record<string, unknown>[] | Record<string, unknown>;
            };
            if (Array.isArray(scoped.data)) {
              scoped.data = scoped.data.map((row) => ({ ...row, companyId }));
            } else if (scoped.data) {
              scoped.data = { ...scoped.data, companyId };
            }
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Atalho para rotas: resolve o client escopado por tenant e o `companyId`
 * a partir do usuário autenticado (`req.user.companyId`, vindo do JWT).
 * Centraliza o fallback seguro combinado na Fase 3 — "o sistema recusa
 * ações sem companyId no token" — em vez de repetir a checagem em cada
 * rota. Retorna os dois juntos (`db` para leituras/updateMany/deleteMany
 * escopados automaticamente pela extensão, `companyId` para preencher
 * explicitamente o `data` de creates, que o TypeScript exige em tempo de
 * compilação já que o campo é obrigatório desde a Fase 4).
 */
export function tenantDb(req: FastifyRequest): { db: ReturnType<typeof withTenant>; companyId: string } {
  const companyId = req.user.companyId;
  if (!companyId) {
    // Code distinto (NO_TENANT) de propósito: cobre tanto o usuário
    // realmente sem tenant quanto uma sessão com JWT emitido antes da
    // migração multi-tenant (sem a claim `companyId`). O frontend usa esse
    // código específico para deslogar automaticamente — diferente do 403
    // comum de `authorize()` por papel, que não deve deslogar ninguém.
    throw new ForbiddenError('Sua sessão está desatualizada. Faça login novamente.', 'NO_TENANT');
  }
  return { db: withTenant(companyId), companyId };
}
