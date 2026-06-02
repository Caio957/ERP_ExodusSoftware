import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSchema } from '@exodus/shared';
import { useAuth } from '../store/auth';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    setLoading(true);
    try {
      await login(parsed.data);
      navigate('/pdv');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-3xl font-bold">
            E
          </div>
          <h1 className="text-2xl font-bold">Exodus Software</h1>
          <p className="text-slate-400">Acesso ao sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">E-mail</label>
            <input
              className="input"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exodus.local"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Senha</label>
            <input
              className="input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-xs text-slate-400">
            Demo: admin@exodus.local / admin12345
          </p>
        </form>
      </div>
    </div>
  );
}
