/** Armazenamento simples do JWT (compartilhado entre o cliente HTTP e o store). */
const KEY = 'exodus_token';

export const tokenStore = {
  get: (): string | null => localStorage.getItem(KEY),
  set: (token: string) => localStorage.setItem(KEY, token),
  clear: () => localStorage.removeItem(KEY),
};
