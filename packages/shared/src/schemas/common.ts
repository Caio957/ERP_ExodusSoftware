import { z } from 'zod';

/** Valor monetário recebido como número, com 2 casas decimais e não-negativo. */
export const money = z
  .number({ invalid_type_error: 'Valor deve ser numérico' })
  .nonnegative('Valor não pode ser negativo')
  .multipleOf(0.01, 'Use no máximo 2 casas decimais');

/** Quantidade inteira positiva. */
export const positiveInt = z
  .number({ invalid_type_error: 'Quantidade deve ser numérica' })
  .int('Quantidade deve ser inteira')
  .positive('Quantidade deve ser maior que zero');

export const uuid = z.string().uuid('Identificador inválido');

/** Paginação padrão para listagens. */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

/** Remove tudo que não for dígito (CPF/CNPJ, telefone). */
export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

/** CPF (11) ou CNPJ (14) — valida apenas o tamanho após limpar a máscara. */
export const document = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((d) => d.length === 11 || d.length === 14, {
    message: 'Documento deve ser um CPF (11) ou CNPJ (14) válido',
  });

/**
 * Política de senha forte (segurança — porta de entrada para dados
 * criptografados na LGPD não vale nada se a senha for fraca): mínimo 8
 * caracteres, com letra minúscula, maiúscula, número e caractere especial.
 * Única fonte de verdade para toda rota que CRIA ou ALTERA uma senha
 * (onboarding público, criação/edição de usuário) — backend e frontend.
 * Deliberadamente NÃO usada em `loginSchema.password`: login valida a
 * senha contra o hash já salvo, que pode ter sido criado sob uma política
 * mais fraca no passado (ex.: os usuários seed `admin12345`/`caixa12345`);
 * aplicar a política atual ali travaria contas antigas fora do sistema.
 */
export const strongPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'A senha deve conter pelo menos um número')
  .regex(/[^a-zA-Z0-9]/, 'A senha deve conter pelo menos um caractere especial');
