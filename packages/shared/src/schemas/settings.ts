import { z } from 'zod';

/**
 * Configurações do formulário de cadastro de produto. Permite ao ADMIN definir
 * quais campos opcionais devem ser obrigatórios na loja, além do padrão de
 * controle de lote/validade.
 */
export const productFormSettingsSchema = z.object({
  brandRequired: z.boolean().default(false),
  groupRequired: z.boolean().default(false),
  subgroupRequired: z.boolean().default(false),
  barcodeRequired: z.boolean().default(false),
  defaultTracksLotValidity: z.boolean().default(false),
});
export type ProductFormSettings = z.infer<typeof productFormSettingsSchema>;

/** Dados cadastrais da empresa contratante (exibidos/editáveis pelo cliente). */
export const companyProfileSchema = z.object({
  name: z.string().trim().max(120).default(''),
  document: z.string().trim().max(20).default(''),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().max(80).default(''),
  address: z.string().trim().max(200).default(''),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;

/**
 * Tipos de recebimento configuráveis (formas de pagamento do PDV).
 * `kind`: CASH entra no caixa em dinheiro; A_PRAZO gera contas a receber;
 * OTHER são as demais formas à vista (cartão, pix, vale, etc.).
 */
export const paymentTypeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(40),
  kind: z.enum(['CASH', 'OTHER', 'A_PRAZO']).default('OTHER'),
  active: z.boolean().default(true),
});
export type PaymentType = z.infer<typeof paymentTypeSchema>;

export const paymentTypesSchema = z.object({
  types: z.array(paymentTypeSchema),
});
export type PaymentTypesSettings = z.infer<typeof paymentTypesSchema>;

/** Lista padrão de tipos de recebimento (usada quando ainda não configurada). */
export const DEFAULT_PAYMENT_TYPES: PaymentType[] = [
  { code: 'CASH', label: 'Dinheiro', kind: 'CASH', active: true },
  { code: 'PIX', label: 'PIX', kind: 'OTHER', active: true },
  { code: 'DEBIT', label: 'Débito', kind: 'OTHER', active: true },
  { code: 'CREDIT', label: 'Crédito', kind: 'OTHER', active: true },
  { code: 'A_PRAZO', label: 'A prazo', kind: 'A_PRAZO', active: true },
];
