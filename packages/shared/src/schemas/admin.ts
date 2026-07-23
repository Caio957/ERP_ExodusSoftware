import { z } from 'zod';

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
