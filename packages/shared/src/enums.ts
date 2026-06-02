import { z } from 'zod';

/**
 * Enums de domínio centralizados. Usamos z.enum para validar payloads e,
 * ao mesmo tempo, derivar os tipos TypeScript (single source of truth).
 * No Prisma esses campos são String (flexibilidade), mas a aplicação valida
 * com estes enums para manter integridade na borda da API.
 */

export const UserRole = z.enum(['ADMIN', 'CASHIER']);
export type UserRole = z.infer<typeof UserRole>;

export const PersonType = z.enum(['CLIENT', 'SUPPLIER']);
export type PersonType = z.infer<typeof PersonType>;

export const PaymentMethod = z.enum(['PIX', 'CREDIT', 'DEBIT', 'CASH']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const SyncStatus = z.enum(['PENDING', 'SYNCED']);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const CashRegisterStatus = z.enum(['OPEN', 'CLOSED']);
export type CashRegisterStatus = z.infer<typeof CashRegisterStatus>;

export const CashTransactionType = z.enum(['SUPPLY', 'BLEED']);
export type CashTransactionType = z.infer<typeof CashTransactionType>;

export const FinancialAccountType = z.enum(['PAYABLE', 'RECEIVABLE']);
export type FinancialAccountType = z.infer<typeof FinancialAccountType>;

export const FinancialAccountStatus = z.enum(['PENDING', 'PAID', 'LATE']);
export type FinancialAccountStatus = z.infer<typeof FinancialAccountStatus>;
