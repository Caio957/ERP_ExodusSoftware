import { z } from 'zod';
import { CompanyStatus } from '../enums.js';

/**
 * Impersonate administrativo (Plano Mestre V2.0, Frente 4 — Auditoria).
 * Suporte técnico da Exodus troca o contexto de tenant para o de um cliente,
 * sem senha/login própria naquela empresa. Autorização é feita fora deste
 * schema (comparação de `req.user.email` com `SUPER_ADMIN_EMAIL`, ver
 * `routes/admin.ts`) — aqui só o alvo da operação.
 */
export const impersonateSchema = z.object({
  targetCompanyId: z.string().uuid(),
});
export type ImpersonateInput = z.infer<typeof impersonateSchema>;

export const impersonateResponseSchema = z.object({
  token: z.string(),
  company: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
});
export type ImpersonateResponse = z.infer<typeof impersonateResponseSchema>;

/**
 * Painel de controle de contratos (Plano Mestre V2.0 — Frente 1, Missão 2).
 * Rotas administrativas globais da Exodus (autorizadas por `SUPER_ADMIN_EMAIL`,
 * ver `routes/admin.ts`) para triagem de tenants: listar por status e mudar o
 * status de uma empresa (aprovar/rejeitar/suspender/reativar).
 */
export const listCompaniesQuerySchema = z.object({
  // Filtro opcional. Sem ele, lista todas as empresas (o painel decide as abas).
  status: CompanyStatus.optional(),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;

/**
 * Mudança de status de um tenant. Aceita o `CompanyStatus` completo de
 * propósito — o "controle de contratos" pedido pelos sócios cobre aprovar
 * (ACTIVE), rejeitar (REJECTED), suspender um cliente ativo inadimplente
 * (BLOCKED) e reativar (ACTIVE), não só aprovar/rejeitar.
 */
export const updateCompanyStatusSchema = z.object({
  status: CompanyStatus,
});
export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;
