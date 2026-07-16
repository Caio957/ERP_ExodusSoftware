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

// 'A_PRAZO' não entra no caixa: gera contas a receber parceladas (PDV-B).
export const PaymentMethod = z.enum(['PIX', 'CREDIT', 'DEBIT', 'CASH', 'A_PRAZO']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** Formas que entram no caixa à vista (excluem 'A_PRAZO'). */
export const CASH_METHODS = ['PIX', 'CREDIT', 'DEBIT', 'CASH'] as const;

export const SyncStatus = z.enum(['PENDING', 'SYNCED']);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const CashRegisterStatus = z.enum(['OPEN', 'CLOSED']);
export type CashRegisterStatus = z.infer<typeof CashRegisterStatus>;

/** DIARIO = caixa físico de balcão (padrão histórico) · BANCO = conta bancária/digital. */
export const CashRegisterType = z.enum(['DIARIO', 'BANCO']);
export type CashRegisterType = z.infer<typeof CashRegisterType>;

export const CashTransactionType = z.enum(['SUPPLY', 'BLEED']);
export type CashTransactionType = z.infer<typeof CashTransactionType>;

export const FinancialAccountType = z.enum(['PAYABLE', 'RECEIVABLE']);
export type FinancialAccountType = z.infer<typeof FinancialAccountType>;

// PARTIAL = baixa parcial. "Vencido" é derivado (dueDate < hoje e status != PAID).
export const FinancialAccountStatus = z.enum(['PENDING', 'PARTIAL', 'PAID']);
export type FinancialAccountStatus = z.infer<typeof FinancialAccountStatus>;
