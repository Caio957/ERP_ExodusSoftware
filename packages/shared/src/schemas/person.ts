import { z } from 'zod';
import { PersonType } from '../enums.js';
import { document } from './common.js';

export const createPersonSchema = z.object({
  type: PersonType,
  name: z.string().trim().min(2, 'Razão social / nome obrigatório'),
  /** Nome fantasia (PJ) ou apelido (PF) — opcional. */
  tradeName: z.string().trim().optional(),
  /**
   * Documento é opcional: clientes de balcão (walk-in) frequentemente não
   * informam CPF. Quando presente, deve ser CPF/CNPJ válido. A unicidade é
   * tratada no banco apenas quando há valor.
   */
  document: document.optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
  phone: z.string().trim().min(8, 'Telefone inválido').optional(),
  // Campos de endereço (preenchidos via BrasilAPI no cadastro de fornecedor).
  zipCode: z.string().trim().optional(),
  street: z.string().trim().optional(),
  number: z.string().trim().optional(),
  district: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().length(2, 'UF deve ter 2 letras').optional(),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial();
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
