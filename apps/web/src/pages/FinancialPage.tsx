import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Lock,
  X,
  Search,
  RotateCcw,
  Filter,
  Landmark,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

type AccountType = 'PAYABLE' | 'RECEIVABLE';
type StatusFilter = 'ALL' | 'OPEN' | 'OVERDUE' | 'NOT_OVERDUE' | 'PARTIAL' | 'PAID';
type OrderBy = 'code' | 'description' | 'dueDate' | 'amount';
type OrderDir = 'asc' | 'desc';

interface Account {
  id: string;
  code: number;
  type: string;
  description: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
  invoiceId?: string | null;
  saleId?: string | null;
  person?: { name: string } | null;
}

export function FinancialPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<AccountType>('PAYABLE');
  const [search, setSearch] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [orderBy, setOrderBy] = useState<OrderBy>('dueDate');
  const [orderDir, setOrderDir] = useState<OrderDir>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [settling, setSettling] = useState<Account | null>(null);

  // Troca de filtro/tipo/ordenação/tamanho de página volta para a primeira página.
  const changeType = (t: AccountType) => { setType(t); setPage(1); };
  const changeSearch = (v: string) => { setSearch(v); setPage(1); };
  const changeDueFrom = (v: string) => { setDueFrom(v); setPage(1); };
  const changeDueTo = (v: string) => { setDueTo(v); setPage(1); };
  const changeStatusFilter = (v: StatusFilter) => { setStatusFilter(v); setPage(1); };
  const changeOrderBy = (v: OrderBy) => { setOrderBy(v); setPage(1); };
  const changeOrderDir = (v: OrderDir) => { setOrderDir(v); setPage(1); };
  const changePageSize = (v: number) => { setPageSize(v); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['financial', type, search, dueFrom, dueTo, statusFilter, orderBy, orderDir, page, pageSize],
    queryFn: () => {
      const qs = new URLSearchParams({
        type,
        page: String(page),
        pageSize: String(pageSize),
        statusFilter,
        orderBy,
        orderDir,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (dueFrom) qs.set('dueFrom', dueFrom);
      if (dueTo) qs.set('dueTo', dueTo);
      return api.get<{ total: number; items: Account[] }>(`/api/financial?${qs.toString()}`);
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const invalidate = () => qc.invalidateQueries({ queryKey: ['financial'] });

  const reverse = useMutation({
    mutationFn: (id: string) => api.post(`/api/financial/${id}/reverse`, {}),
    onSuccess: invalidate,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao estornar'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/financial/${id}`),
    onSuccess: invalidate,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  const totalOpen =
    data?.items.filter((a) => a.status !== 'PAID').reduce((acc, a) => acc + (a.amount - a.paidAmount), 0) ?? 0;
  const totalOverdue =
    data?.items
      .filter((a) => a.status !== 'PAID' && new Date(a.dueDate) < today0())
      .reduce((acc, a) => acc + (a.amount - a.paidAmount), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Landmark className="h-6 w-6" />
          </span>
          <div>
            <h1 className="page-title">Financeiro</h1>
            <p className="text-sm text-slate-500">Contas a pagar e a receber da loja.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> Novo lançamento
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button className={type === 'PAYABLE' ? 'btn-primary' : 'btn-ghost'} onClick={() => changeType('PAYABLE')}>
            <ArrowUpCircle className="h-5 w-5" /> A Pagar
          </button>
          <button className={type === 'RECEIVABLE' ? 'btn-primary' : 'btn-ghost'} onClick={() => changeType('RECEIVABLE')}>
            <ArrowDownCircle className="h-5 w-5" /> A Receber
          </button>
          <button className={showFilters ? 'btn-primary' : 'btn-ghost'} onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-5 w-5" /> Filtros
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-soft">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Saldo em aberto</div>
            <div className={`text-xl font-bold ${type === 'PAYABLE' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {brl(totalOpen)}
            </div>
          </div>
          {totalOverdue > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-right shadow-soft">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">Vencido</div>
              <div className="text-xl font-bold text-rose-700">{brl(totalOverdue)}</div>
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="card grid animate-fade-in gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="label">Buscar (descrição/pessoa)</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" value={search} onChange={(e) => changeSearch(e.target.value)} />
            </div>
          </label>
          <label className="block">
            <span className="label">Vencimento de</span>
            <input className="input" type="date" value={dueFrom} onChange={(e) => changeDueFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Vencimento até</span>
            <input className="input" type="date" value={dueTo} onChange={(e) => changeDueTo(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Status</span>
            <select className="input" value={statusFilter} onChange={(e) => changeStatusFilter(e.target.value as StatusFilter)}>
              <option value="ALL">Todos</option>
              <option value="OPEN">Abertos</option>
              <option value="OVERDUE">Vencidos</option>
              <option value="NOT_OVERDUE">A Vencer</option>
              <option value="PARTIAL">Quitados Parcialmente</option>
              <option value="PAID">Quitados</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Ordenar por</span>
            <select className="input" value={orderBy} onChange={(e) => changeOrderBy(e.target.value as OrderBy)}>
              <option value="code">Código</option>
              <option value="description">Descrição</option>
              <option value="dueDate">Vencimento</option>
              <option value="amount">Valor</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Ordem</span>
            <select className="input" value={orderDir} onChange={(e) => changeOrderDir(e.target.value as OrderDir)}>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">Cód.</th>
                <th>Descrição</th>
                <th>Pessoa</th>
                <th>Vencimento</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((a) => {
                const locked = !!a.invoiceId || !!a.saleId;
                const hasSettlement = a.paidAmount > 0;
                const overdue = a.status !== 'PAID' && new Date(a.dueDate) < today0();
                const saldo = round2(a.amount - a.paidAmount);
                return (
                  <tr key={a.id} className={overdue ? 'bg-rose-50/60' : ''}>
                    <td className="py-2 font-medium text-slate-500">#{a.code}</td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        {locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                        {a.description}
                      </span>
                    </td>
                    <td className="text-slate-500">{a.person?.name ?? '—'}</td>
                    <td className={overdue ? 'font-semibold text-rose-600' : ''}>
                      {new Date(a.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="text-right font-medium">
                      {brl(a.amount)}
                      {a.status === 'PARTIAL' && (
                        <div className="text-xs font-normal text-amber-600">resta {brl(saldo)}</div>
                      )}
                    </td>
                    <td>
                      <StatusTag status={a.status} overdue={overdue} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {a.status !== 'PAID' && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            onClick={() => setSettling(a)}
                            title="Baixar"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                          </button>
                        )}
                        {hasSettlement && (
                          <button
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-amber-50 hover:text-amber-600"
                            onClick={() => {
                              if (window.confirm('Estornar a última baixa deste título?')) reverse.mutate(a.id);
                            }}
                            title="Estornar última baixa"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {!locked && !hasSettlement && a.status === 'PENDING' ? (
                          <>
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                              onClick={() => setEditing(a)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => {
                                if (window.confirm(`Excluir "${a.description}"?`)) remove.mutate(a.id);
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          !hasSettlement && (
                            <span
                              className="grid h-8 w-8 place-items-center text-slate-300"
                              title="Protegido (origem ou já baixado)"
                            >
                              <Lock className="h-4 w-4" />
                            </span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum lançamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.items.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Linhas por página
              <select
                className="input h-9 w-auto py-1"
                value={String(pageSize)}
                onChange={(e) => changePageSize(Number(e.target.value))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>

            <div className="flex items-center gap-3 text-sm">
              <button
                className="btn-ghost h-9 px-3"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <span className="text-slate-500">
                Página <span className="font-semibold text-slate-700">{page}</span> de{' '}
                <span className="font-semibold text-slate-700">{totalPages}</span>
              </span>
              <button
                className="btn-ghost h-9 px-3"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próximo <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {creating && (
        <NewEntryModal initialType={type} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); invalidate(); }} />
      )}
      {editing && (
        <EditEntryModal account={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />
      )}
      {settling && (
        <SettleModal account={settling} onClose={() => setSettling(null)} onDone={() => { setSettling(null); invalidate(); }} />
      )}

      <ScrollToTopButton />
    </div>
  );
}

// Botão flutuante "Voltar ao topo" — Dark Glassmorphism (mesmo padrão de
// RegistrationsPage.tsx). Ejetado via createPortal(..., document.body): o
// `animate-fade-in` do Layout.tsx deixa um `transform` persistente no wrapper
// de rota, virando containing block e quebrando `position: fixed` em
// descendentes (o botão desceria junto com a lista em vez de ficar ancorado
// no viewport).
function ScrollToTopButton() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return createPortal(
    <button
      className={`fixed right-4 bottom-24 md:bottom-8 md:right-8 z-50 backdrop-blur-md transition-all duration-500 shadow-xl rounded-full p-3 flex items-center justify-center ${
        showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-12 pointer-events-none'
      }`}
      style={{ backgroundColor: hover ? 'rgba(30, 41, 59, 0.9)' : 'rgba(30, 41, 59, 0.6)', color: 'white' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Voltar ao topo"
    >
      <ArrowUp className="w-6 h-6" />
    </button>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
function NewEntryModal({
  initialType,
  onClose,
  onCreated,
}: {
  initialType: AccountType;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<AccountType>(initialType);
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installments, setInstallments] = useState('1');
  const [intervalDays, setIntervalDays] = useState('30');
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const personType = type === 'PAYABLE' ? 'SUPPLIER' : 'CLIENT';
  const nParcelas = Math.max(1, Number(installments) || 1);
  const valorParcela = (Number(totalAmount) || 0) / nParcelas;

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/financial/installments', {
        type,
        description,
        totalAmount: Number(totalAmount),
        firstDueDate,
        installments: nParcelas,
        intervalDays: Number(intervalDays) || 30,
        personId: person?.id,
      }),
    onSuccess: onCreated,
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : 'Falha ao lançar'),
  });

  function submit() {
    setLocalError(null);
    if (description.trim().length < 1) return setLocalError('Informe a descrição.');
    if (Number(totalAmount) <= 0) return setLocalError('Valor total deve ser maior que zero.');
    if (!person) return setLocalError(`Informe o ${personType === 'SUPPLIER' ? 'fornecedor' : 'cliente'}.`);
    create.mutate();
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-md flex flex-col max-h-[90dvh] !p-0 overflow-hidden">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="font-display text-lg font-bold">Novo lançamento</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button className={type === 'PAYABLE' ? 'btn-primary' : 'btn-ghost'} onClick={() => { setType('PAYABLE'); setPerson(null); }}>
              <ArrowUpCircle className="h-5 w-5" /> A Pagar
            </button>
            <button className={type === 'RECEIVABLE' ? 'btn-primary' : 'btn-ghost'} onClick={() => { setType('RECEIVABLE'); setPerson(null); }}>
              <ArrowDownCircle className="h-5 w-5" /> A Receber
            </button>
          </div>

          <label className="block">
            <span className="label">{personType === 'SUPPLIER' ? 'Fornecedor' : 'Cliente'} *</span>
            <PersonPicker type={personType} value={person} onChange={setPerson} />
          </label>

          <label className="block">
            <span className="label">Descrição *</span>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label">Valor total (R$) *</span>
              <input className="input" type="number" inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">1º vencimento *</span>
              <input className="input" type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Nº de parcelas *</span>
              <input className="input" type="number" min={1} value={installments} onChange={(e) => setInstallments(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Intervalo (dias)</span>
              <input className="input" type="number" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </label>
          </div>

          {nParcelas > 1 && (
            <div className="rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-brand-700">
              {nParcelas}× de aprox. <strong>{brl(valorParcela)}</strong> (a cada {intervalDays || 30} dias)
            </div>
          )}

          {(localError || create.error instanceof ApiError) && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {localError ?? (create.error as ApiError).message}
            </div>
          )}
        </div>

        <footer className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 p-4 bg-slate-50">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={create.isPending} onClick={submit}>
            {create.isPending ? 'Salvando...' : 'Lançar'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
function SettleModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const saldo = round2(account.amount - account.paidAmount);
  const [amount, setAmount] = useState(String(saldo));
  const [settleInFull, setSettleInFull] = useState(false);
  const val = Number(amount) || 0;
  const isPartial = val > 0 && val < saldo;

  const settle = useMutation({
    mutationFn: () => api.post(`/api/financial/${account.id}/settle`, { amount: val, settleInFull: isPartial ? settleInFull : false }),
    onSuccess: onDone,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha na baixa'),
  });

  return (
    <Modal title="Baixar título" onClose={onClose}>
      <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Valor do título</span><span>{brl(account.amount)}</span></div>
        {account.paidAmount > 0 && (
          <div className="flex justify-between"><span className="text-slate-500">Já baixado</span><span>{brl(account.paidAmount)}</span></div>
        )}
        <div className="flex justify-between font-semibold"><span>Saldo</span><span>{brl(saldo)}</span></div>
      </div>

      <label className="block">
        <span className="label">Valor a baixar (R$)</span>
        <input className="input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </label>

      {isPartial && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={settleInFull} onChange={(e) => setSettleInFull(e.target.checked)} />
          <span>
            <span className="font-semibold text-amber-700">Quitar integralmente</span>
            <span className="block text-xs text-amber-600">
              Valor menor que o saldo. Marque para quitar o título mesmo assim (perdoa {brl(round2(saldo - val))}). Sem marcar, fica baixa parcial.
            </span>
          </span>
        </label>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={settle.isPending || val <= 0 || val > saldo + 0.001} onClick={() => settle.mutate()}>
          {settle.isPending ? 'Baixando...' : isPartial && !settleInFull ? 'Baixar parcial' : 'Confirmar baixa'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function EditEntryModal({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState(account.description);
  const [amount, setAmount] = useState(String(account.amount));
  const [dueDate, setDueDate] = useState(account.dueDate.slice(0, 10));

  const save = useMutation({
    mutationFn: () => api.put(`/api/financial/${account.id}`, { description, amount: Number(amount), dueDate }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  return (
    <Modal title="Editar lançamento" onClose={onClose}>
      <label className="block">
        <span className="label">Descrição</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Valor (R$)</span>
          <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Vencimento</span>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function PersonPicker({
  type,
  value,
  onChange,
}: {
  type: 'SUPPLIER' | 'CLIENT';
  value: { id: string; name: string } | null;
  onChange: (p: { id: string; name: string } | null) => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['fin-persons', type, term],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string }> }>(
        `/api/persons?type=${type}&pageSize=20${term.trim() ? `&search=${encodeURIComponent(term.trim())}` : ''}`,
      ),
    enabled: !value,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <span className="font-medium">{value.name}</span>
        <button className="text-xs underline" onClick={() => onChange(null)}>trocar</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar..." />
      {data && data.items.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
          {data.items.map((p) => (
            <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onChange(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="modal-overlay">
      <div className={`modal-sheet ${wide ? 'sm:max-w-lg' : 'sm:max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusTag({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Vencido</span>;
  const map: Record<string, { c: string; t: string }> = {
    PAID: { c: 'bg-emerald-100 text-emerald-700', t: 'Pago' },
    PARTIAL: { c: 'bg-amber-100 text-amber-700', t: 'Parcial' },
    PENDING: { c: 'bg-slate-100 text-slate-600', t: 'Pendente' },
  };
  const s = map[status] ?? { c: 'bg-slate-100', t: status };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.c}`}>{s.t}</span>;
}
