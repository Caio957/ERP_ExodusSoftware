import fp from 'fastify-plugin';
import { env } from '../env.js';
import { ForbiddenError } from '../lib/errors.js';
import { getTenantBillingStatus } from '../lib/billing-guard.js';

/**
 * Guarda de inadimplência (Faturamento SaaS, Pilar 2b).
 *
 * Até o Pilar 2, `isBlocked` existia apenas como flag consultiva em
 * `GET /api/billing/current` — um tenant bloqueado que chamasse `/api/sales`
 * direto na API era atendido normalmente. Bloqueio que só vive na UI é
 * bloqueio contornável. Este hook o torna efetivo no servidor.
 */

/**
 * Prefixos que NUNCA são bloqueados. Bloquear qualquer um deles deixaria o
 * lojista num beco sem saída: sem `/auth` ele não loga nem carrega a própria
 * sessão, sem `/billing/current` não enxerga o PIX para pagar, e sem `/admin`
 * o suporte da Exodus não consegue destravá-lo.
 *
 * `/api/auth/` inclui o CRUD de usuários (`/api/auth/users`) — decisão
 * consciente: gerenciar operador não move dinheiro. O tenant bloqueado segue
 * sem vender, comprar, baixar título ou ver relatório, que é o que importa.
 */
const BILLING_ALLOWLIST = [
  '/api/auth/',
  '/api/billing/current',
  '/api/admin/',
  '/api/onboarding',
];

export const billingGuardPlugin = fp(async (app) => {
  app.addHook('preHandler', async (req) => {
    /**
     * `routeOptions.url` é o PADRÃO REGISTRADO da rota (ex.: `/api/products/:id`),
     * não a URL crua enviada pelo cliente. Casar a allowlist contra o padrão
     * impede que um caminho como `/api/auth/../products` bata no prefixo
     * isento e contorne a guarda — a allowlist é o lado permissivo da regra,
     * então nunca deve ser decidida a partir de string controlada pelo cliente.
     */
    const routeUrl = req.routeOptions?.url ?? req.url.split('?')[0] ?? '';

    // Fora de `/api/` não há rota de negócio: `/health` e os assets do PWA
    // servidos pelo @fastify/static no monolito.
    if (!routeUrl.startsWith('/api/')) return;
    if (BILLING_ALLOWLIST.some((prefix) => routeUrl.startsWith(prefix))) return;

    // Sem header não há sessão a avaliar — a própria rota devolve 401 se
    // exigir autenticação. Evita tentar verificar JWT à toa em rota pública.
    if (!req.headers.authorization) return;

    /**
     * ⚠️ `app.authenticate` é um preHandler DE ROTA, e no Fastify os hooks de
     * instância rodam ANTES dos preHandlers da rota — ou seja, aqui ele ainda
     * não rodou e `req.user` está indefinido. Ler `req.user` direto não seria
     * um no-op: quebraria com TypeError em toda requisição. Por isso a guarda
     * verifica o token por conta própria.
     */
    try {
      await req.jwtVerify();
    } catch {
      // Token ausente/expirado/inválido é 401 do `authenticate` da rota, não
      // 403 de inadimplência — deixa a rota decidir.
      return;
    }

    // Suporte técnico da Exodus precisa entrar JUSTAMENTE na loja bloqueada —
    // é quando o cliente liga pedindo ajuda para se regularizar.
    if (req.user.isImpersonating) return;

    // Super Admin opera fora da lógica de mensalidade (a empresa sede da
    // Exodus não é um tenant faturado).
    if (env.SUPER_ADMIN_EMAIL && req.user.email === env.SUPER_ADMIN_EMAIL) return;

    const companyId = req.user.companyId;
    // Sessão sem tenant: `tenantDb` já responde NO_TENANT na própria rota,
    // com o código que faz o frontend deslogar. Não é caso desta guarda.
    if (!companyId) return;

    const { isBlocked } = await getTenantBillingStatus(companyId);
    if (isBlocked) {
      // `code` próprio (e não o `FORBIDDEN` genérico) para o Pilar 3 conseguir
      // distinguir "seu perfil não permite" de "sua empresa está em atraso" e
      // abrir a tela de cobrança em vez de um erro seco — mesmo precedente do
      // `NO_TENANT` em `lib/tenant.ts`.
      throw new ForbiddenError(
        'Acesso bloqueado por inadimplência. Regularize sua mensalidade para continuar usando o sistema.',
        'BILLING_BLOCKED',
      );
    }
  });
});
