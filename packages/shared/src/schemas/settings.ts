import { z } from 'zod';

/**
 * Configurações do formulário de cadastro de produto. Permite ao ADMIN definir
 * quais campos opcionais devem ser obrigatórios na loja, além do padrão de
 * controle de lote/validade.
 */
export const productFormSettingsSchema = z.object({
  subgroupRequired: z.boolean().default(false),
  barcodeRequired: z.boolean().default(false),
  defaultTracksLotValidity: z.boolean().default(false),
});
export type ProductFormSettings = z.infer<typeof productFormSettingsSchema>;
