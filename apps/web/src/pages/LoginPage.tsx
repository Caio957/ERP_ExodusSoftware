import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, type LoginCompanyOption } from '@exodus/shared';
import { Sparkles, Mail, Lock, ArrowRight, ShieldCheck, Zap, WifiOff, Gem, Building2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../store/auth';
import { ApiError } from '../lib/api';

const highlights = [
  { icon: Zap, title: 'PDV ágil', desc: 'Venda em segundos com leitor de código de barras.', gold: false },
  { icon: WifiOff, title: 'Funciona offline', desc: 'Continue vendendo mesmo sem internet.', gold: true },
  { icon: ShieldCheck, title: 'Controle total', desc: 'Estoque, caixa e financeiro num só lugar.', gold: false },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Mesmo e-mail + senha conferem em mais de uma empresa (contador/franqueado
  // — User.email deixou de ser globalmente único). Sem token ainda: mostra
  // esse seletor em vez do formulário normal, reenvia o login com o
  // companyId escolhido.
  const [pendingCompanies, setPendingCompanies] = useState<LoginCompanyOption[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email: email.trim(), password: password.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    setLoading(true);
    try {
      const result = await login(parsed.data);
      if (!result.ok) {
        setPendingCompanies(result.companies);
        return;
      }
      navigate('/pdv');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectCompany(companyId: string) {
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password: password.trim(), companyId });
      if (!result.ok) {
        // Não deveria acontecer (companyId já desambiguado) — mas se
        // acontecer, evita deixar a tela num estado sem saída.
        setPendingCompanies(result.companies);
        return;
      }
      navigate('/pdv');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao entrar');
      setPendingCompanies(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca — azul-noite dramático */}
      <aside className="relative hidden overflow-hidden bg-royal-gradient lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        {/* Brilho cônico girando + orbes flutuantes azul/dourado + grade */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow bg-shine opacity-70" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-float rounded-full bg-accent-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 animate-float-slow rounded-full bg-brand-400/40 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/3 h-64 w-64 animate-glow-pulse rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid bg-[length:38px_38px] opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />

        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-accent-300/50 backdrop-blur-sm">
            E
          </span>
          <div>
            <div className="font-display text-xl font-extrabold leading-none">Exodus</div>
            <div className="text-sm text-accent-200/80">Software</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent-400/15 px-3 py-1 text-sm font-semibold text-accent-100 ring-1 ring-accent-300/40 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" /> ERP para lojas de cosméticos
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight xl:text-5xl">
            Sua loja de beleza,
            <br />
            <span className="gradient-text-gold">no controle total.</span>
          </h1>
          <p className="mt-4 text-lg text-blue-100/80">
            Estoque, vendas e caixa em uma experiência pensada para o balcão.
          </p>

          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li
                key={h.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition-all duration-300 hover:translate-x-1.5 hover:bg-white/10"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-lg ${
                    h.gold ? 'bg-gold-gradient text-ink-900' : 'bg-brand-gradient text-white'
                  }`}
                >
                  <h.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold">{h.title}</div>
                  <div className="text-sm text-blue-100/70">{h.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-sm text-blue-100/60">
          <Gem className="h-4 w-4 text-accent-300" />© {new Date().getFullYear()} Exodus Software · Feito para o
          varejo de beleza
        </div>
      </aside>

      {/* Formulário */}
      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="gradient-border w-full max-w-sm animate-fade-in rounded-3xl bg-white/80 p-6 shadow-card backdrop-blur-xl sm:p-8">
          {/* Marca compacta (mobile) */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-3xl font-bold text-white shadow-brand ring-2 ring-accent-300">
              E
            </div>
            <h1 className="font-display text-2xl font-extrabold gradient-text">Exodus Software</h1>
            <p className="text-slate-500">ERP para lojas de cosméticos</p>
          </div>

          {pendingCompanies ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-3xl font-extrabold">
                  Escolha sua <span className="gradient-text">empresa</span>
                </h2>
                <p className="mt-1 text-slate-500">
                  Este e-mail tem acesso a mais de uma loja. Selecione qual você quer acessar.
                </p>
              </div>

              <div className="space-y-3">
                {pendingCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left font-semibold text-ink-900 transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                    onClick={() => handleSelectCompany(company.id)}
                  >
                    <span className="icon-tile shrink-0">
                      <Building2 className="h-5 w-5" />
                    </span>
                    {company.name}
                  </button>
                ))}
              </div>

              {error && (
                <div className="animate-scale-in mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="btn-ghost mt-4 w-full"
                disabled={loading}
                onClick={() => {
                  setPendingCompanies(null);
                  setError(null);
                }}
              >
                <ArrowLeft className="h-5 w-5" /> Voltar
              </button>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-3xl font-extrabold">
                  Bem-vinda de <span className="gradient-text">volta</span> 👋
                </h2>
                <p className="mt-1 text-slate-500">Entre para começar a vender.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">E-mail</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
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
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
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

                <button className="btn-primary w-full text-lg" disabled={loading}>
                  {loading ? (
                    'Entrando...'
                  ) : (
                    <>
                      Entrar <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
