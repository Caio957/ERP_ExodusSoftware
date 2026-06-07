import { useState } from 'react';
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

const PAGE_SIZE = 50;

export function FinancialPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<AccountType>('PAYABLE');
  const [search, setSearch] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [settling, setSettling] = useState<Account | null>(null);

  // Troca de filtro/tipo volta para a primeira página.
  const changeType = (t: AccountType) => { setType(t); setPage(1); };
  const changeSearch = (v: string) => { setSearch(v); setPage(1); };
  const changeDueFrom = (v: string) => { setDueFrom(v); setPage(1); };
  const changeDueTo = (v: string) => { setDueTo(v); setPage(1); };

  const { data, isLoading } = useQuery({
    queryKey: ['financial', type, search, dueFrom, dueTo, page],
    queryFn: () => {
      const qs = new URLSearchParams({ type, page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) qs.set('search', search.trim());
      if (dueFrom) qs.set('dueFrom', dueFrom);
      if (dueTo) qs.set('dueTo', dueTo);
      return api.get<{ total: number; items: Account[] }>(`/api/financial?${qs.toString()}`);
    },
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="text-sm text-slate-500">Contas a pagar e a receber da loja.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> Novo lançamento
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
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
        <div className="flex gap-2">
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
        <div className="card grid animate-fade-in gap-3 sm:grid-cols-3">
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
        {total > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {total} título(s) · página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </button>
              <button
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
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
    </div>
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

  return (
    <Modal title="Novo lançamento" onClose={onClose} wide>
      <div className="mb-3 grid grid-cols-2 gap-2">
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

      <label className="mt-3 block">
        <span className="label">Descrição *</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
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
        <div className="mt-3 rounded-xl bg-brand-50/60 px-3 py-2 text-sm text-brand-700">
          {nParcelas}× de aprox. <strong>{brl(valorParcela)}</strong> (a cada {intervalDays || 30} dias)
        </div>
      )}

      {(localError || create.error instanceof ApiError) && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {localError ?? (create.error as ApiError).message}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={create.isPending} onClick={submit}>
          {create.isPending ? 'Salvando...' : 'Lançar'}
        </button>
      </div>
    </Modal>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} animate-scale-in overflow-auto rounded-2xl bg-white p-6 shadow-elevated`}>
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
