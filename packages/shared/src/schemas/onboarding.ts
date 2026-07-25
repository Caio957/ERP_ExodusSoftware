import { z } from 'zod';
import { document } from './common.js';

/**
 * Auto-cadastro público de um novo lojista (Plano Mestre V2.0 — Frente 1,
 * Onboarding). Cria uma `Company` com status PENDING + o primeiro usuário
 * ADMIN dela, numa transação única. A empresa fica aguardando aprovação
 * manual da equipe Exodus antes de poder logar (ver `routes/onboarding.ts`).
 */
export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, 'Nome da empresa obrigatório'),
  // Reaproveita o validador `document` do projeto (remove máscara e exige
  // 11/14 dígitos). O campo é chamado `cnpj` no contrato público, mas aceita
  // CPF (MEI/autônomo) também — mesma regra de `Person.document`.
  cnpj: document,
  adminName: z.string().trim().min(2, 'Nome do responsável obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const onboardingResponseSchema = z.object({
  message: z.string(),
  companyId: z.string().uuid(),
  status: z.literal('PENDING'),
});
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;
