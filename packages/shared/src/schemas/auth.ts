import { z } from 'zod';
import { UserRole } from '../enums.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
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
