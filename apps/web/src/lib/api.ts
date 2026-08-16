import { tokenStore } from './token';
import { useAuth } from '../store/auth';
import { queryClient } from './queryClient';

/** URL base da API. Em dev usamos o proxy do Vite ('/api'). */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

/**
 * Wrapper de fetch: injeta JWT, serializa JSON e normaliza erros da API
 * (que seguem o formato { statusCode, code, message } do error-handler).
 */
export async function apiFetch<T = unknown>(
  path: string,
  { body, auth = true, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set('Content-Type', 'application/json');
  if (auth) {
    const token = tokenStore.get();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && (data as { message?: string })?.message) || `Erro ${res.status}`;
    const code = isJson ? (data as { code?: string })?.code : undefined;
    if (res.status === 401) tokenStore.clear();
    // NO_TENANT: sessão sem empresa associada (JWT emitido antes da migração
    // multi-tenant, ou usuário genuinamente sem tenant). Diferente do 403
    // comum de RBAC por papel (ex.: CASHIER numa rota de ADMIN) — aquele
    // deve só mostrar a mensagem de erro, sem deslogar ninguém. Só este
    // código específico dispara logout automático — location.href em vez de
    // useNavigate porque este módulo roda fora da árvore React. `logout()`
    // pode recusar (vendas locais pendentes de sincronizar): nesse caso
    // avisa em vez de forçar o redirecionamento e apagar dados não
    // sincronizados.
    if (code === 'NO_TENANT') {
      void useAuth
        .getState()
        .logout()
        .then((result) => {
          if (result.ok) window.location.href = '/login';
          else window.alert(result.message);
        });
    }
    // BILLING_BLOCKED: a guarda de inadimplência (Pilar 2b) recusou uma rota
    // de negócio. Em vez de deixar a tela mostrar um erro genérico de "acesso
    // negado", refaz a leitura de /billing/current — que está na allowlist da
    // guarda e portanto continua acessível — para o `BillingGate` reagir à
    // flag nova e subir a tela de bloqueio com o PIX.
    // Diferente de NO_TENANT, NÃO desloga nem limpa o token: a sessão é
    // válida; o que falta é pagamento, não autenticação.
    if (code === 'BILLING_BLOCKED') {
      void queryClient.invalidateQueries({ queryKey: ['billing', 'current'] });
    }
    throw new ApiError(res.status, message, code, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  del: <T>(path: string, opts?: RequestOptions) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
};
