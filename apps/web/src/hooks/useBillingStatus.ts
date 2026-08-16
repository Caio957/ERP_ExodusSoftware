import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

/** Fatura de mensalidade em aberto do próprio tenant (`GET /api/billing/current`). */
export interface CurrentBilling {
  id: string;
  amount: number;
  dueDate: string;
  pixPayload: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface BillingSettings {
  billingReminderDays: number;
  billingBlockGraceDays: number;
  billingExempt: boolean;
}

/**
 * Flags calculadas NO SERVIDOR (routes/billing.ts + lib/billing-guard.ts).
 * `daysUntilDue`/`daysOverdue` vêm prontos de propósito: o dia de calendário é
 * resolvido no fuso da loja (America/Sao_Paulo) e o front nunca refaz essa
 * aritmética — só formata.
 */
export interface BillingFlags {
  shouldShowReminder: boolean;
  isOverdue: boolean;
  isBlocked: boolean;
  daysUntilDue: number | null;
  daysOverdue: number;
}

export interface BillingStatusResponse {
  billing: CurrentBilling | null;
  settings: BillingSettings;
  flags: BillingFlags;
}

/** Chave estável e compartilhada — `lib/api.ts` a invalida ao ver BILLING_BLOCKED. */
export const BILLING_CURRENT_KEY = ['billing', 'current'] as const;

/**
 * Situação de cobrança do tenant logado. A `queryKey` fixa faz o React Query
 * deduplicar: qualquer componente pode chamar este hook sem gerar requisição
 * extra, então não é preciso um Context só para compartilhar o estado.
 */
export function useBillingStatus() {
  const token = useAuth((s) => s.token);

  const query = useQuery({
    queryKey: BILLING_CURRENT_KEY,
    queryFn: () => api.get<BillingStatusResponse>('/api/billing/current'),
    enabled: Boolean(token),
    // Mensalidade muda em escala de dias — não faz sentido reconsultar a cada
    // navegação. O caminho crítico (ficar bloqueado no meio do expediente) é
    // coberto pela invalidação disparada no `BILLING_BLOCKED` (lib/api.ts).
    staleTime: 5 * 60_000,
  });

  return {
    billing: query.data?.billing ?? null,
    settings: query.data?.settings ?? null,
    flags: query.data?.flags ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
