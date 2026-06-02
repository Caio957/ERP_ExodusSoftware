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
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: async (input) => {
        const data = await api.post<AuthResponse>('/api/auth/login', input, { auth: false });
        tokenStore.set(data.token);
        set({ token: data.token, user: data.user });
      },
      logout: () => {
        tokenStore.clear();
        set({ token: null, user: null });
      },
      isAdmin: () => get().user?.role === 'ADMIN',
    }),
    {
      name: 'exodus_auth',
      // Mantém o tokenStore em sincronia ao reidratar do localStorage.
      onRehydrateStorage: () => (state) => {
        if (state?.token) tokenStore.set(state.token);
      },
    },
  ),
);
