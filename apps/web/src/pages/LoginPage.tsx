import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSchema } from '@exodus/shared';
import { Sparkles, Mail, Lock, ArrowRight, ShieldCheck, Zap, WifiOff } from 'lucide-react';
import { useAuth } from '../store/auth';
import { ApiError } from '../lib/api';

const highlights = [
  { icon: Zap, title: 'PDV ágil', desc: 'Venda em segundos com leitor de código de barras.' },
  { icon: WifiOff, title: 'Funciona offline', desc: 'Continue vendendo mesmo sem internet.' },
  { icon: ShieldCheck, title: 'Controle total', desc: 'Estoque, caixa e financeiro num só lugar.' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function fillDemo() {
    setEmail('admin@exodus.local');
    setPassword('admin12345');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Tolera espaços acidentais (autofill/teclado de tablet) antes de validar.
    const parsed = loginSchema.safeParse({ email: email.trim(), password: password.trim() });
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <aside className="relative hidden overflow-hidden bg-brand-gradient bg-[length:200%_200%] animate-gradient-x lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        {/* Orbes flutuantes + grade sutil */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-float rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 animate-float-slow rounded-full bg-accent-500/30 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-64 w-64 animate-glow-pulse rounded-full bg-brand-300/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid bg-[length:36px_36px] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur-sm ring-1 ring-white/30">
            E
          </span>
          <div>
            <div className="font-display text-xl font-extrabold leading-none">Exodus</div>
            <div className="text-sm text-white/70">Software</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium ring-1 ring-white/25 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" /> ERP para lojas de cosméticos
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight xl:text-5xl">
            Sua loja de beleza, no controle total.
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Estoque, vendas e caixa em uma experiência pensada para o balcão.
          </p>

          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li
                key={h.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-md transition-all duration-300 hover:translate-x-1 hover:bg-white/15"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <h.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-sm text-white/70">{h.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-white/60">
          © {new Date().getFullYear()} Exodus Software · Feito para o varejo de beleza
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-in rounded-3xl border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur-xl sm:p-8">
          {/* Marca compacta (mobile) */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-3xl font-bold text-white shadow-brand">
              E
            </div>
            <h1 className="font-display text-2xl font-extrabold">Exodus Software</h1>
            <p className="text-slate-500">ERP para lojas de cosméticos</p>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="font-display text-3xl font-bold">Bem-vinda de volta 👋</h2>
            <p className="mt-1 text-slate-500">Entre para começar a vender.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-11"
                  type="email"
                  value={email}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exodus.local"
                />
              </div>
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-11"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="animate-scale-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  Entrar <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={fillDemo}
            className="mt-6 w-full rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-3 text-center text-xs text-slate-500 transition hover:bg-brand-100/60"
          >
            <span className="font-semibold text-brand-700">Toque para preencher o acesso demo</span>
            <br />
            admin@exodus.local / admin12345
          </button>
        </div>
      </main>
    </div>
  );
}
