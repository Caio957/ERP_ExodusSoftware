import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyStatus, ImpersonateResponse } from '@exodus/shared';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  List,
  RotateCcw,
  LogIn,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';

interface CompanyAdminUser {
  id: string;
  name: string;
  email: string;
}

interface CompanyRow {
  id: string;
  name: string;
  document: string | null;
  status: CompanyStatus;
  createdAt: string;
  users: CompanyAdminUser[];
}

type TabKey = CompanyStatus | 'ALL';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'PENDING', label: 'Pendentes', icon: Clock },
  { key: 'ACTIVE', label: 'Ativos', icon: CheckCircle2 },
  { key: 'REJECTED', label: 'Rejeitados', icon: XCircle },
  { key: 'BLOCKED', label: 'Bloqueados', icon: Ban },
  { key: 'ALL', label: 'Todas', icon: List },
];

const STATUS_META: Record<CompanyStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Pendente', badge: 'badge-warning' },
  ACTIVE: { label: 'Ativo', badge: 'badge-success' },
  REJECTED: { label: 'Rejeitado', badge: 'badge-danger' },
  BLOCKED: { label: 'Bloqueado', badge: 'badge-neutral' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Back-Office da Exodus — gestão de contratos (Plano Mestre V2.0, Frente 1).
 * Protegida por `<SuperAdminRoute>` (App.tsx): só chega aqui quem tem
 * `user.isSuperAdmin` no store. A trava de verdade é sempre o backend
 * (`assertSuperAdmin`, routes/admin.ts) — esta tela só lista/aprova.
 *
 * "Acessar Loja" (impersonate) dispara `POST /api/admin/impersonate` e
 * delega a troca de sessão para `impersonateLogin` (store/auth.ts) — ver lá
 * o motivo de não reaproveitar `GET /auth/me` nesse fluxo.
 */
export function AdminContractsPage() {
  const { user, impersonateLogin } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('PENDING');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'companies', tab],
    queryFn: () => api.get<CompanyRow[]>(`/api/admin/companies${tab === 'ALL' ? '' : `?status=${tab}`}`),
  });

  // Busca client-side sobre a lista já filtrada por aba — mesmo padrão de
  // "busca onisciente" já usado em Cadastros/Vendas/Compras: a API só filtra
  // por status, o refinamento por texto acontece localmente.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.document ?? '').toLowerCase().includes(term) ||
        c.users.some(
          (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
        ),
    );
  }, [data, search]);

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CompanyStatus }) =>
      api.patch<CompanyRow>(`/api/admin/companies/${id}/status`, { status }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      flash(`${updated.name}: status atualizado para "${STATUS_META[updated.status].label}".`);
    },
    onError: (e) =>
      window.alert(e instanceof ApiError ? e.message : 'Falha ao atualizar o status da empresa.'),
  });

  function confirmAndChange(company: CompanyRow, status: CompanyStatus, confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return;
    changeStatus.mutate({ id: company.id, status });
  }

  // Impersonate ("Acessar Loja"): troca a sessão ativa para a empresa-alvo
  // e força um reload completo em /dashboard — não um `navigate` do router.
  // O reload é deliberado: remonta o React Query do zero, sem risco de uma
  // tela ainda exibir cache da própria empresa do super admin por um
  // instante após a troca de tenant.
  const impersonate = useMutation({
    mutationFn: (targetCompanyId: string) =>
      api.post<ImpersonateResponse>('/api/admin/impersonate', { targetCompanyId }),
    onSuccess: (res) => {
      impersonateLogin(res.token, res.company);
      window.location.href = '/dashboard';
    },
    onError: (e) =>
      window.alert(e instanceof ApiError ? e.message : 'Falha ao acessar a loja como suporte.'),
  });

  function accessAsSupport(company: CompanyRow) {
    if (
      !window.confirm(
        `Acessar a loja "${company.name}" como suporte? Essa ação fica registrada em auditoria.`,
      )
    )
      return;
    impersonate.mutate(company.id);
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho premium — deixa claro que é área restrita da Exodus */}
      <div className="flex items-center gap-3">
        <span className="icon-tile-gold h-11 w-11">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Painel Administrativo</h1>
          <p className="text-sm text-slate-500">Gestão de contratos — Back-Office exclusivo da Exodus.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-accent-300 bg-accent-50 px-4 py-2.5 text-xs font-semibold text-accent-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Área restrita: as ações abaixo liberam ou bloqueiam o acesso de empresas clientes reais ao
        sistema. Toda mudança de status fica registrada em auditoria.
      </div>

      {/* Abas por status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setTab(t.key)}
            >
              <t.icon className="h-5 w-5" /> {t.label}
            </button>
          ))}
        </div>
        {!isLoading && !isError && (
          <span className="text-xs font-semibold text-slate-400">
            {filtered.length} empresa{filtered.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <label className="block max-w-md">
        <span className="label">Buscar (empresa, CNPJ/CPF, administrador)</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar a lista atual..."
          />
        </div>
      </label>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : isError ? (
        <div className="card space-y-2 border border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-700">
            Falha ao carregar empresas: {error instanceof ApiError ? error.message : 'erro desconhecido'}
          </p>
          <button className="btn-ghost" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card grid h-32 place-items-center text-sm text-slate-400">
          Nenhuma empresa encontrada para este filtro.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">Empresa</th>
                <th>Administrador(es)</th>
                <th>Cadastrada em</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const isOwnCompany = c.id === user?.companyId;
                const meta = STATUS_META[c.status];
                const busy = changeStatus.isPending && changeStatus.variables?.id === c.id;
                return (
                  <tr key={c.id}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2 font-semibold text-ink-900">
                        <Building2 className="h-4 w-4 text-brand-500" /> {c.name}
                      </div>
                      {c.document && <div className="text-xs text-slate-400">{c.document}</div>}
                    </td>
                    <td className="text-slate-500">
                      {c.users.length === 0 ? (
                        '—'
                      ) : (
                        <div className="space-y-0.5">
                          {c.users.map((u) => (
                            <div key={u.id} className="flex flex-wrap items-center gap-x-1.5">
                              <span className="font-medium text-slate-600">{u.name}</span>
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Mail className="h-3 w-3" /> {u.email}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-slate-500">{fmtDate(c.createdAt)}</td>
                    <td>
                      <span className={meta.badge}>{meta.label}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status === 'PENDING' && (
                          <>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              disabled={busy}
                              onClick={() =>
                                confirmAndChange(
                                  c,
                                  'ACTIVE',
                                  `Aprovar "${c.name}"? A empresa passará a poder acessar o sistema.`,
                                )
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                              disabled={busy}
                              onClick={() =>
                                confirmAndChange(c, 'REJECTED', `Rejeitar o cadastro de "${c.name}"?`)
                              }
                            >
                              <XCircle className="h-3.5 w-3.5" /> Rejeitar
                            </button>
                          </>
                        )}
                        {c.status === 'ACTIVE' && !isOwnCompany && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
                            disabled={impersonate.isPending}
                            title="Entrar nesta loja como suporte técnico Exodus"
                            onClick={() => accessAsSupport(c)}
                          >
                            <LogIn className="h-3.5 w-3.5" /> Acessar Loja
                          </button>
                        )}
                        {c.status === 'ACTIVE' && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                            disabled={busy || isOwnCompany}
                            title={isOwnCompany ? 'Você não pode bloquear a própria empresa.' : undefined}
                            onClick={() =>
                              confirmAndChange(
                                c,
                                'BLOCKED',
                                `Bloquear "${c.name}"? A empresa perderá acesso imediatamente.`,
                              )
                            }
                          >
                            <Ban className="h-3.5 w-3.5" /> Bloquear
                          </button>
                        )}
                        {(c.status === 'REJECTED' || c.status === 'BLOCKED') && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            disabled={busy}
                            onClick={() =>
                              confirmAndChange(
                                c,
                                'ACTIVE',
                                `Reativar "${c.name}"? A empresa voltará a poder acessar o sistema.`,
                              )
                            }
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Reativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-elevated animate-slide-up md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
