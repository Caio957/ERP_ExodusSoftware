import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação rígida das variáveis de ambiente na inicialização.
 * Falha rápido (fail-fast) se algo estiver ausente/incorreto.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url('DATABASE_URL inválida'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Criptografia de dados sensíveis (Plano Mestre V2.0, Frente 2 — LGPD, ver
  // lib/encryption.ts). Exatamente 32 bytes (AES-256) em hex (64 caracteres)
  // ou base64 — gere com `openssl rand -hex 32`.
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => {
      if (/^[0-9a-fA-F]{64}$/.test(v)) return true;
      try {
        return Buffer.from(v, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'ENCRYPTION_KEY deve representar exatamente 32 bytes (AES-256) em hex de 64 caracteres ou base64'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
