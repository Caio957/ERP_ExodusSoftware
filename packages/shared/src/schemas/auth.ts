import { z } from 'zod';
import { UserRole } from '../enums.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  /**
   * Multi-tenant (Plano Mestre V2.0): só é necessário quando o mesmo e-mail
   * + a mesma senha existem em mais de uma empresa (ex.: contador/franqueado
   * com acesso a várias lojas — User.email deixou de ser globalmente único).
   * O login comum nunca precisa enviar isso; o backend só pede esse campo
   * de volta através da resposta `needsCompanySelection`.
   */
  companyId: z.string().uuid().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: UserRole,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Payload (claims) contido no JWT. */
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRole,
  // Multi-tenant (Plano Mestre V2.0, Fase 3): tenant do usuário autenticado.
  // Nullable porque `User.companyId` ainda é opcional no schema (Fase 1) —
  // na prática, após o backfill, todo usuário existente já tem um valor.
  // O backend SEMPRE deriva o companyId de uma escrita/leitura a partir
  // desta claim (nunca de um campo enviado pelo body da requisição).
  companyId: z.string().uuid().nullable(),
  /**
   * Presentes só durante uma sessão de impersonate (Plano Mestre V2.0,
   * Frente 4 — suporte técnico "acessando como" outra empresa,
   * `POST /api/admin/impersonate`). `sub`/`email`/`name` continuam
   * identificando o usuário REAL (rastreabilidade em `AuditLog`) — só
   * `companyId` é trocado para o tenant-alvo. `originalUserId` é redundante
   * com `sub` neste desenho (nunca trocamos o `sub`), mas mantido explícito
   * no payload para o frontend não precisar assumir esse detalhe de
   * implementação ao decidir se mostra a faixa de aviso.
   */
  isImpersonating: z.boolean().optional(),
  originalUserId: z.string().uuid().optional(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: UserRole,
    companyId: z.string().uuid().nullable(),
  }),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * Resposta alternativa de `/auth/login` quando a senha confere para o mesmo
 * e-mail em mais de uma empresa (User.email escopado por tenant — Plano
 * Mestre V2.0). Sem token ainda: o frontend mostra um seletor e reenvia o
 * login com `companyId` preenchido. Deliberadamente só é retornada DEPOIS de
 * validar a senha (nunca antes) — revelar a lista de empresas de um e-mail
 * sem provar a senha primeiro seria um vazamento de enumeração de contas.
 */
export const loginCompanyOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type LoginCompanyOption = z.infer<typeof loginCompanyOptionSchema>;

export const loginNeedsCompanySchema = z.object({
  needsCompanySelection: z.literal(true),
  companies: z.array(loginCompanyOptionSchema),
});
export type LoginNeedsCompany = z.infer<typeof loginNeedsCompanySchema>;

export const loginResponseSchema = z.union([authResponseSchema, loginNeedsCompanySchema]);
export type LoginResponse = z.infer<typeof loginResponseSchema>;
