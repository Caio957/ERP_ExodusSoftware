import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, LoginInput, UserRole } from '@exodus/shared';
import { api } from '../lib/api';
import { tokenStore } from '../lib/token';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedPages: string[] | null; // null = usar padrão do papel
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
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
        const data = await api.post<AuthResponse>('/api/auth/login', input, { auth: false });
        tokenStore.set(data.token);
        // Busca allowedPages do perfil completo após login
        const me = await api.get<AuthUser & { allowedPages: string[] | null }>('/api/auth/me');
        set({ token: data.token, user: { ...data.user, allowedPages: me.allowedPages ?? null } });
      },
      logout: () => {
        tokenStore.clear();
        set({ token: null, user: null });
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
