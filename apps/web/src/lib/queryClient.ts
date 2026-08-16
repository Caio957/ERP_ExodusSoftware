import { QueryClient } from '@tanstack/react-query';

/**
 * Instância única do React Query.
 *
 * Extraída de `main.tsx` (onde era uma const local, invisível de fora) porque
 * `lib/api.ts` precisa invalidar queries ao interceptar um `BILLING_BLOCKED` —
 * e esse módulo roda FORA da árvore React, sem acesso a hooks. Importar daqui
 * não cria ciclo: este arquivo só depende de `@tanstack/react-query`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
});
