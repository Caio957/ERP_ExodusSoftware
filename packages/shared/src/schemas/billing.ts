import { z } from 'zod';
import { money } from './common.js';
import { TenantBillingStatus } from '../enums.js';

/**
 * Faturamento SaaS (mensalidade dos tenants) — Pilar 2.
 * Rotas de escrita são exclusivas do Super Admin (`assertSuperAdmin`, ver
 * `routes/admin.ts`); o tenant só tem leitura (`GET /api/billing/current`).
 */

/**
 * Vencimento de mensalidade: é um DIA DE CALENDÁRIO, não um instante.
 *
 * Base `z.coerce.date()` (convenção do projeto — aceita tanto `'2026-08-20'`
 * quanto ISO completo, com ou sem offset; `z.string().datetime()` sem
 * `{ offset: true }` REJEITARIA `-03:00`). Em cima disso, um `transform` que
 * **reancora o instante em meia-noite de Brasília** (= 03:00Z).
 *
 * Por que reancorar: `z.coerce.date()` transforma `'2026-08-20'` em
 * `2026-08-20T00:00:00Z`, que em America/Sao_Paulo é **19/08 às 21h**. Como
 * todo o cálculo de atraso roda no fuso da loja, a fatura apareceria vencida
 * um dia antes do vencimento real (e, com carência 0, bloquearia o cliente
 * indevidamente). Gravando às 03:00Z, o instante cai no MESMO dia de
 * calendário lido em UTC e em Brasília — imune ao off-by-one dos dois lados.
 *
 * O dia pretendido é extraído da representação UTC (`toISOString`), que é
 * exatamente o que o usuário digitou num `<input type="date">`.
 */
const dueDateBr = z.coerce.date().transform((parsed) => {
  const day = parsed.toISOString().slice(0, 10);
  return new Date(`${day}T00:00:00.000-03:00`);
});

/** Criação de fatura de mensalidade (Super Admin). */
export const createTenantBillingSchema = z.object({
  companyId: z.string().uuid(),
  // `money` (nonnegative + multipleOf 0.01) + refine de positividade — mesmo
  // idioma de cashTransactionSchema/createInstallmentsSchema.
  amount: money.refine((v) => v > 0, 'Valor deve ser maior que zero'),
  dueDate: dueDateBr,
  pixPayload: z.string().trim().min(10, 'PIX Copia e Cola inválido'),
});
export type CreateTenantBillingInput = z.infer<typeof createTenantBillingSchema>;

/**
 * Baixa ou cancelamento de fatura. Deliberadamente NÃO aceita 'PENDING' —
 * uma fatura nasce PENDING pelo `@default` do schema e só caminha para um
 * estado terminal; "despagar" uma fatura não é uma operação prevista.
 */
export const updateTenantBillingStatusSchema = z.object({
  status: z.enum(['PAID', 'CANCELLED']),
});
export type UpdateTenantBillingStatusInput = z.infer<typeof updateTenantBillingStatusSchema>;

/**
 * Configurações de cobrança de um tenant. Todos os campos opcionais (o admin
 * pode ajustar só um), mas o `.refine()` recusa um corpo vazio — que passaria
 * na validação e faria um UPDATE sem efeito, gastando um registro de auditoria
 * à toa.
 */
export const updateCompanyBillingSettingsSchema = z
  .object({
    billingReminderDays: z.number().int().min(0).max(30).optional(),
    billingBlockGraceDays: z.number().int().min(0).max(30).optional(),
    billingExempt: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });
export type UpdateCompanyBillingSettingsInput = z.infer<typeof updateCompanyBillingSettingsSchema>;

/** Filtros da listagem de faturas (Super Admin). Sem filtro = todas. */
export const listTenantBillingsQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: TenantBillingStatus.optional(),
});
export type ListTenantBillingsQuery = z.infer<typeof listTenantBillingsQuerySchema>;
