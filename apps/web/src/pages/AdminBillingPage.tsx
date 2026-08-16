import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyStatus, TenantBillingStatus } from '@exodus/shared';
import {
  CreditCard,
  ShieldAlert,
  Plus,
  X,
  Clock,
  CheckCircle2,
  Ban,
  List,
  QrCode,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { AdminNav } from '../components/admin/AdminNav';
import { PixPanel } from '../components/billing/PixPanel';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O vencimento é gravado às 03:00Z justamente para o dia de calendário bater
 * em UTC e em Brasília (ver `dueDateBr` em schemas/billing.ts). Formatar em
 * UTC preserva isso em qualquer fuso do dispositivo.
 */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Dias de atraso em DIA DE CALENDÁRIO no fuso da loja — mesma regra do
 * backend (`diffDaysBr`, apps/api/src/lib/dates.ts), replicada aqui só para o
 * rótulo "Vencido há N dias" da grade do Super Admin. O lojista nunca usa
 * isto: `/api/billing/current` já entrega `daysOverdue` pronto.
 */
function daysOverdueBr(dueIso: string): number {
  const startOfDay = (d: Date) =>
    new Date(`${d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}T00:00:00.000-03:00`);
  const diff = startOfDay(new Date(dueIso)).getTime() - startOfDay(new Date()).getTime();
  return Math.round(-diff / 86_400_000);
}

interface BillingCompany {
  id: string;
  name: string;
  document: string | null;
  status: CompanyStatus;
}

interface BillingRow {
  id: string;
  companyId: string;
  amount: number;
  dueDate: string;
  pixPayload: string;
  status: TenantBillingStatus;
  paidAt: string | null;
  createdAt: string;
  company: BillingCompany;
}

interface CompanyOption {
  id: string;
  name: string;
  status: CompanyStatus;
}

type TabKey = TenantBillingStatus | 'ALL';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'PENDING', label: 'Em aberto', icon: Clock },
  { key: 'PAID', label: 'Pagas', icon: CheckCircle2 },
  { key: 'CANCELLED', label: 'Canceladas', icon: Ban },
  { key: 'ALL', label: 'Todas', icon: List },
];

const STATUS_META: Record<TenantBillingStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Em aberto', badge: 'badge-warning' },
  PAID: { label: 'Paga', badge: 'badge-success' },
  CANCELLED: { label: 'Cancelada', badge: 'badge-neutral' },
};

/**
 * Back-Office da Exodus — Faturamento SaaS (Pilar 3). Página irmã de
 * `/admin/contratos`, mesma proteção `<SuperAdminRoute>`: emite, baixa e
 * cancela as mensalidades dos tenants. A política de cobrança por empresa
 * (aviso prévio / carência / isenção) fica na tela de Contratos, junto da
 * listagem de empresas.
 */
export function AdminBillingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('PENDING');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [pixOf, setPixOf] = useState<BillingRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'billing', tab, companyFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (tab !== 'ALL') params.set('status', tab);
      if (companyFilter) params.set('companyId', companyFilter);
      const qs = params.toString();
      return api.get<BillingRow[]>(`/api/admin/billing${qs ? `?${qs}` : ''}`);
    },
  });

  // Empresas para o filtro e para o select do modal de emissão.
  const { data: companies } = useQuery({
    queryKey: ['admin', 'companies', 'ALL'],
    queryFn: () => api.get<CompanyOption[]>('/api/admin/companies'),
  });

  const activeCompanies = useMemo(
    () => (companies ?? []).filter((c) => c.status === 'ACTIVE'),
    [companies],
  );

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PAID' | 'CANCELLED' }) =>
      api.patch<BillingRow>(`/api/admin/billing/${id}/status`, { status }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
      flash(vars.status === 'PAID' ? 'Fatura baixada com sucesso.' : 'Fatura cancelada.');
    },
    onError: (e) =>
      window.alert(e instanceof ApiError ? e.message : 'Falha ao atualizar o status da fatura.'),
  });

  function confirmAndChange(row: BillingRow, status: 'PAID' | 'CANCELLED') {
    const verb =
      status === 'PAID'
        ? `Confirmar o pagamento de ${brl(row.amount)} de "${row.company.name}"? O acesso da loja é liberado imediatamente.`
        : `Cancelar a fatura de ${brl(row.amount)} de "${row.company.name}"? Esta ação não pode ser desfeita.`;
    if (!window.confirm(verb)) return;
    changeStatus.mutate({ id: row.id, status });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="icon-tile-gold h-11 w-11">
          <CreditCard className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Faturamento</h1>
          <p className="text-sm text-slate-500">
            Mensalidades dos tenants — Back-Office exclusivo da Exodus.
          </p>
        </div>
      </div>

      <AdminNav />

      <div className="flex items-start gap-2 rounded-xl border border-accent-300 bg-accent-50 px-4 py-2.5 text-xs font-semibold text-accent-800">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Baixar uma fatura libera o acesso da loja imediatamente; deixá-la vencer além da carência
        bloqueia o sistema do cliente. Toda alteração fica registrada em auditoria.
      </div>

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
        <button className="btn-gold" onClick={() => setShowNew(true)}>
          <Plus className="h-5 w-5" /> Lançar mensalidade
        </button>
      </div>

      <label className="block max-w-md">
        <span className="label">Filtrar por empresa</span>
        <select
          className="input"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="">Todas as empresas</option>
          {(companies ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : isError ? (
        <div className="card space-y-2 border border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-700">
            Falha ao carregar faturas:{' '}
            {error instanceof ApiError ? error.message : 'erro desconhecido'}
          </p>
          <button className="btn-ghost" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="card grid h-32 place-items-center text-sm text-slate-400">
          Nenhuma fatura encontrada para este filtro.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">Empresa</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Pago em</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data ?? []).map((row) => {
                const meta = STATUS_META[row.status];
                const overdue = row.status === 'PENDING' ? daysOverdueBr(row.dueDate) : 0;
                const busy = changeStatus.isPending && changeStatus.variables?.id === row.id;
                return (
                  <tr key={row.id}>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2 font-semibold text-ink-900">
                        <Building2 className="h-4 w-4 text-brand-500" /> {row.company.name}
                      </div>
                      {row.company.document && (
                        <div className="text-xs text-slate-400">{row.company.document}</div>
                      )}
                    </td>
                    <td className="font-semibold text-ink-900">{brl(row.amount)}</td>
                    <td className="text-slate-500">{fmtDate(row.dueDate)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={meta.badge}>{meta.label}</span>
                        {overdue > 0 && (
                          <span className="badge-danger">
                            Vencido há {overdue} {overdue === 1 ? 'dia' : 'dias'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-500">{row.paidAt ? fmtDateTime(row.paidAt) : '—'}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                          onClick={() => setPixOf(row)}
                        >
                          <QrCode className="h-3.5 w-3.5" /> Ver PIX
                        </button>
                        {row.status === 'PENDING' && (
                          <>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => confirmAndChange(row, 'PAID')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                            </button>
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => confirmAndChange(row, 'CANCELLED')}
                            >
                              <Ban className="h-3.5 w-3.5" /> Cancelar
                            </button>
                          </>
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

      {showNew && (
        <NewBillingModal
          companies={activeCompanies}
          onClose={() => setShowNew(false)}
          onCreated={(msg) => {
            qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
            flash(msg);
            setShowNew(false);
          }}
        />
      )}

      {pixOf && <PixViewModal row={pixOf} onClose={() => setPixOf(null)} />}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-elevated animate-slide-up md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

/** Emissão de mensalidade (Padrão Ouro). */
function NewBillingModal({
  companies,
  onClose,
  onCreated,
}: {
  companies: CompanyOption[];
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [companyId, setCompanyId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: { companyId: string; amount: number; dueDate: string; pixPayload: string }) =>
      api.post<BillingRow>('/api/admin/billing', payload),
    onSuccess: (row) => onCreated(`Fatura de ${brl(row.amount)} emitida para ${companyName()}.`),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Falha ao emitir a fatura.'),
  });

  const companyName = () => companies.find((c) => c.id === companyId)?.name ?? 'a empresa';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!companyId) return setError('Selecione a empresa.');
    // Vírgula decimal é o padrão de digitação em pt-BR (mesmo tratamento do
    // resto do sistema — ver `sanitizeBr` em PdvPage/FinancialPage).
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return setError('Informe um valor maior que zero.');
    if (!dueDate) return setError('Informe a data de vencimento.');
    if (pixPayload.trim().length < 10) return setError('Cole o PIX Copia e Cola da cobrança.');

    create.mutate({
      companyId,
      amount: Math.round(value * 100) / 100,
      // `<input type="date">` entrega 'YYYY-MM-DD'; o backend reancora em
      // meia-noite de Brasília (`dueDateBr`), então enviar a data pura é o
      // caminho correto — mandar um ISO completo do browser reintroduziria
      // o off-by-one de fuso que o schema existe para evitar.
      dueDate,
      pixPayload: pixPayload.trim(),
    });
  }

  return createPortal(
    <div className="modal-overlay">
      <form
        onSubmit={submit}
        className="modal-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden !p-0 sm:max-w-lg"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <span className="icon-tile-gold h-9 w-9">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">Lançar mensalidade</h3>
              <p className="text-xs text-slate-500">A fatura nasce em aberto (PENDING).</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="label">Empresa *</span>
            <select className="input" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">Selecione...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              Apenas empresas com contrato ativo.
            </span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Valor (R$) *</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                placeholder="149,90"
                value={amount}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
                }}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
              />
            </label>
            <label className="block">
              <span className="label">Vencimento *</span>
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="label">PIX Copia e Cola *</span>
            <textarea
              className="input min-h-[110px] font-mono text-xs"
              placeholder="00020126580014BR.GOV.BCB.PIX..."
              value={pixPayload}
              onChange={(e) => setPixPayload(e.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-400">
              Fica cifrado no banco e é exibido ao lojista com QR Code.
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Emitindo...' : 'Emitir fatura'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}

/** "Ver PIX" — mantém o payload fora da grade, que ficaria ilegível com ele. */
function PixViewModal({ row, onClose }: { row: BillingRow; onClose: () => void }) {
  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden !p-0 sm:max-w-md">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <span className="icon-tile h-9 w-9">
              <QrCode className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">{row.company.name}</h3>
              <p className="text-xs text-slate-500">
                {brl(row.amount)} · vence em {fmtDate(row.dueDate)}
              </p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <PixPanel pixPayload={row.pixPayload} compact />
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
