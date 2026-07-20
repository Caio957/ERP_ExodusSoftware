import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LoginCompanyOption, LoginInput, LoginResponse, UserRole } from '@exodus/shared';
import { api } from '../lib/api';
import { tokenStore } from '../lib/token';
import { db } from '../lib/db';
import { flushQueue } from '../lib/sync';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedPages: string[] | null; // null = usar padrão do papel
  /**
   * Empresa (tenant) do usuário logado. Null só é esperado para um futuro
   * usuário global (SYSTEM_ADMIN, sem tenant único — ver schema.prisma).
   * Base para isolar a fila offline do Dexie por tenant (Plano Mestre V2.0,
   * Fase 3 — fila/cache local não podem sobreviver a uma troca de empresa
   * no mesmo dispositivo).
   */
  companyId: string | null;
}

/** Resultado do logout — pode ser recusado se houver vendas locais pendentes. */
export interface LogoutResult {
  ok: boolean;
  message?: string;
}

/**
 * Resultado do login. `ok: false` só acontece quando o mesmo e-mail + senha
 * conferem em mais de uma empresa (User.email escopado por tenant — Plano
 * Mestre V2.0) — a tela precisa mostrar um seletor e chamar `login()` de
 * novo com `companyId` preenchido.
 */
export type LoginResult = { ok: true } | { ok: false; companies: LoginCompanyOption[] };

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<LoginResult>;
  logout: () => Promise<LogoutResult>;
  isAdmin: () => boolean;
  canAccess: (pageKey: string) => boolean;
}

// Páginas acessíveis por padrão para o papel CASHIER
const CASHIER_DEFAULT_PAGES = ['pdv', 'products', 'cash', 'registrations'];

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: async (input) => {
        const data = await api.post<LoginResponse>('/api/auth/login', input, { auth: false });
        if ('needsCompanySelection' in data) {
          return { ok: false, companies: data.companies };
        }

        tokenStore.set(data.token);
        // Busca allowedPages + companyId do perfil completo após login — /me
        // sempre lê fresco do banco (não confia na claim do JWT, que pode
        // ter até 12h), mesmo raciocínio já aplicado a allowedPages.
        const me = await api.get<AuthUser>('/api/auth/me');
        set({
          token: data.token,
          user: { ...data.user, allowedPages: me.allowedPages ?? null, companyId: me.companyId },
        });
        return { ok: true };
      },
      // Purga o Dexie (fila de vendas + cache de produtos) ao sair — impede
      // que dados de um tenant sobrevivam no dispositivo para a próxima
      // sessão (Plano Mestre V2.0, Fase 3). Recusa o logout se ainda houver
      // vendas locais não sincronizadas do tenant ativo: apagá-las seria
      // perder dinheiro real de forma silenciosa e irreversível. Tenta um
      // último flush se estiver online antes de decidir bloquear.
      logout: async () => {
        const companyId = get().user?.companyId;
        if (companyId) {
          const countPending = () =>
            db.saleQueue.where('companyId').equals(companyId).count();

          if ((await countPending()) > 0 && navigator.onLine) {
            await flushQueue();
          }

          const stillPending = await countPending();
          if (stillPending > 0) {
            return {
              ok: false,
              message: `Existem ${stillPending} venda(s) ainda não sincronizada(s) neste dispositivo. Conecte-se à internet e aguarde a sincronização antes de sair.`,
            };
          }
        }

        await db.saleQueue.clear();
        await db.variants.clear();
        tokenStore.clear();
        set({ token: null, user: null });
        return { ok: true };
      },
      isAdmin: () => get().user?.role === 'ADMIN',
      canAccess: (pageKey: string) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'ADMIN') return true;
        const allowed = user.allowedPages;
        if (!allowed) return CASHIER_DEFAULT_PAGES.includes(pageKey);
        return allowed.includes(pageKey);
      },
    }),
    {
      name: 'exodus_auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) tokenStore.set(state.token);
      },
    },
  ),
);
