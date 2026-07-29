import { z } from 'zod';
import { document, strongPasswordSchema } from './common.js';
import { isValidCpfOrCnpj } from '../utils/validators.js';

/**
 * Auto-cadastro público de um novo lojista (Plano Mestre V2.0 — Frente 1,
 * Onboarding). Cria uma `Company` com status PENDING + o primeiro usuário
 * ADMIN dela, numa transação única. A empresa fica aguardando aprovação
 * manual da equipe Exodus antes de poder logar (ver `routes/onboarding.ts`).
 */
export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, 'Nome da empresa obrigatório'),
  // Reaproveita o validador `document` do projeto (remove máscara e exige
  // 11/14 dígitos) — mesma regra de `Person.document` — e empilha mais um
  // `.refine()` só aqui: dígito verificador (Módulo 11) real. Deliberadamente
  // NÃO aplicado ao `document` base em `common.ts` (usado por `Person`) —
  // o onboarding é a porta de entrada de um tenant novo e pode ser mais
  // estrito; apertar `Person.document` também afetaria cadastros de
  // clientes/fornecedores já existentes fora do escopo desta missão.
  cnpj: document.refine((val) => isValidCpfOrCnpj(val), { message: 'CPF ou CNPJ inválido' }),
  adminName: z.string().trim().min(2, 'Nome do responsável obrigatório'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: strongPasswordSchema,
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const onboardingResponseSchema = z.object({
  message: z.string(),
  companyId: z.string().uuid(),
  status: z.literal('PENDING'),
});
export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;
