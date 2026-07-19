import { prisma } from './prisma.js';

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
 * queries.
 *
 * ⚠️ Mecanismo criado na Fase 3 do plano — ainda NÃO está ligado a nenhuma
 * rota. A virada de chave (trocar o `prisma` importado de `./prisma.js` por
 * `withTenant(req.user.companyId)` dentro de cada rota) é trabalho da
 * Fase 4, depois de `companyId` virar obrigatório no schema. Até lá, seguir
 * usando o `prisma` singleton normalmente.
 *
 * ⚠️ Limitação conhecida e deliberada: operações por seletor único
 * (`findUnique`, `findUniqueOrThrow`, `update`, `delete`, `upsert`) NÃO são
 * escopadas aqui — o Prisma não aceita mesclar um campo arbitrário no
 * `where` de um seletor `@id`/`@unique` sem quebrar a tipagem gerada. Na
 * Fase 4 essas operações precisam ser resolvidas rota a rota (ex.: trocar
 * `findUnique({ where: { id } })` por `findFirst({ where: { id, companyId } })`,
 * ou manter uma checagem pós-fetch como já é feito hoje em `GET /sales/:id`
 * para o isolamento RBAC entre ADMIN/CASHIER).
 */
export function withTenant(companyId: string) {
  if (!companyId) {
    throw new Error('withTenant: companyId é obrigatório para escopar o client por tenant');
  }

  return prisma.$extends({
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
