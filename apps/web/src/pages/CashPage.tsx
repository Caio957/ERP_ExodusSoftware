import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  Lock,
  Clock,
  Scale,
  History,
  Pencil,
  Trash2,
  X,
  Receipt,
  PieChart,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const methodLabel: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  A_PRAZO: 'A prazo',
  SPLIT: 'Múltiplas formas',
};

interface CashRegister {
  id: string;
  initialCash: number;
  finalCash?: number | null;
  expectedCash?: number;
  openedAt: string;
  closedAt?: string | null;
  status: string;
  user?: { name: string };
}

export function CashPage() {
  const [tab, setTab] = useState<'atual' | 'historico'>('atual');

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Caixa</h1>
        <div className="flex gap-2">
          <button className={tab === 'atual' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('atual')}>
            <Wallet className="h-5 w-5" /> Atual
          </button>
          <button className={tab === 'historico' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('historico')}>
            <History className="h-5 w-5" /> Histórico
          </button>
        </div>
      </div>

      {tab === 'atual' ? <CurrentCash /> : <CashHistory />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function CurrentCash() {
  const qc = useQueryClient();
  const [initialCash, setInitialCash] = useState('');
  const [txModal, setTxModal] = useState<{ type: 'SUPPLY' | 'BLEED' } | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; difference: number } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current'],
    queryFn: () => api.get<CashRegister | null>('/api/cash/current'),
  });

  const open = useMutation({
    mutationFn: () => api.post('/api/cash/open', { initialCash: Number(initialCash) }),
    onSuccess: () => {
      setInitialCash('');
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['cash-current'] });
    qc.invalidateQueries({ queryKey: ['cash-movements'] });
    qc.invalidateQueries({ queryKey: ['cash-summary'] });
  }

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  if (!register) {
    return (
      <div className="card animate-scale-in">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-brand">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Abrir caixa</h2>
            <p className="text-sm text-slate-500">Informe o fundo de troco inicial.</p>
          </div>
        </div>
        <label className="label">Valor inicial (R$)</label>
        <input
          className="input mb-3 text-lg"
          type="number"
          inputMode="decimal"
          value={initialCash}
          onChange={(e) => setInitialCash(e.target.value)}
          placeholder="0,00"
        />
        {open.error instanceof ApiError && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {open.error.message}
          </div>
        )}
        <button className="btn-primary w-full" disabled={!initialCash || open.isPending} onClick={() => open.mutate()}>
          {open.isPending ? 'Abrindo...' : 'Abrir caixa'}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-brand">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Clock className="h-4 w-4" />
              Aberto desde {new Date(register.openedAt).toLocaleString('pt-BR')}
            </div>
            <div className="mt-3 text-sm text-white/70">Saldo atual em caixa</div>
            <div className="font-display text-4xl font-extrabold">
              {brl(register.expectedCash ?? register.initialCash)}
            </div>
            <div className="mt-1 text-sm text-white/70">Fundo inicial: {brl(register.initialCash)}</div>
          </div>
          <span className="badge bg-white/20 text-white ring-1 ring-white/30">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {register.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost py-6 text-base" onClick={() => setTxModal({ type: 'SUPPLY' })}>
          <PlusCircle className="h-5 w-5 text-emerald-600" /> Suprimento
        </button>
        <button className="btn-ghost py-6 text-base" onClick={() => setTxModal({ type: 'BLEED' })}>
          <MinusCircle className="h-5 w-5 text-rose-600" /> Sangria
        </button>
      </div>

      <button className="btn-danger w-full py-5 text-base" onClick={() => setClosing(true)}>
        <Lock className="h-5 w-5" /> Fechar caixa
      </button>

      <RegisterSummary registerId={register.id} />
      <RegisterMovements registerId={register.id} canEdit onChanged={refresh} />

      {txModal && (
        <TransactionModal
          registerId={register.id}
          type={txModal.type}
          onClose={() => setTxModal(null)}
          onSaved={() => {
            setTxModal(null);
            refresh();
          }}
        />
      )}

      {closing && (
        <CloseModal
          registerId={register.id}
          onClose={() => setClosing(false)}
          onClosed={(result) => {
            setClosing(false);
            setCloseResult(result);
            refresh();
          }}
        />
      )}

      {closeResult && (
        <div className="card animate-scale-in border-2 border-brand-200">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Scale className="h-5 w-5 text-brand-600" /> Resumo do fechamento
          </h3>
          <Row label="Esperado em caixa" value={brl(closeResult.expectedCash)} />
          <Row
            label="Diferença"
            value={brl(closeResult.difference)}
            tone={closeResult.difference < 0 ? 'rose' : 'emerald'}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
interface Movement {
  kind: 'TRANSACTION' | 'SALE';
  id: string;
  type?: string;
  paymentMethod?: string;
  amount: number;
  description?: string;
  client?: string | null;
  at: string;
}

function RegisterMovements({
  registerId,
  canEdit,
  onChanged,
}: {
  registerId: string;
  canEdit?: boolean;
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState<Movement | null>(null);
  const { data } = useQuery({
    queryKey: ['cash-movements', registerId],
    queryFn: () => api.get<{ movements: Movement[] }>(`/api/cash/${registerId}/movements`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/cash/transactions/${id}`),
    onSuccess: () => onChanged?.(),
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  if (!data) return null;

  return (
    <div className="card">
      <h3 className="mb-3 font-semibold">Movimentações</h3>
      {data.movements.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Nenhuma movimentação ainda.</p>
      ) : (
        <ul className="space-y-1">
          {data.movements.map((m) => (
            <li
              key={`${m.kind}-${m.id}`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-slate-50"
            >
              {m.kind === 'SALE' ? (
                <>
                  <span className="flex items-center gap-2 text-slate-600">
                    <Receipt className="h-4 w-4 text-brand-500" />
                    Venda · {methodLabel[m.paymentMethod ?? ''] ?? m.paymentMethod}
                    {m.client && <span className="text-slate-400">· {m.client}</span>}
                  </span>
                  <span className="font-semibold text-emerald-600">+{brl(m.amount)}</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    {m.type === 'SUPPLY' ? (
                      <PlusCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <MinusCircle className="h-4 w-4 text-rose-600" />
                    )}
                    {m.description}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold ${m.type === 'SUPPLY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.type === 'SUPPLY' ? '+' : '−'}
                      {brl(m.amount)}
                    </span>
                    {canEdit && (
                      <span className="flex gap-0.5">
                        <button
                          className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                          onClick={() => setEditing(m)}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => {
                            if (window.confirm('Excluir esta movimentação?')) remove.mutate(m.id);
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TransactionModal
          registerId={registerId}
          type={editing.type as 'SUPPLY' | 'BLEED'}
          editing={{ id: editing.id, amount: editing.amount, description: editing.description ?? '' }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function RegisterSummary({ registerId }: { registerId: string }) {
  const isAdmin = useAuth((s) => s.isAdmin());
  const { data } = useQuery({
    queryKey: ['cash-summary', registerId],
    queryFn: () =>
      api.get<{ salesByMethod: Array<{ paymentMethod: string; count: number; total: number }> }>(
        `/api/cash/${registerId}/summary`,
      ),
    enabled: isAdmin,
  });

  if (!isAdmin || !data || data.salesByMethod.length === 0) return null;

  const total = data.salesByMethod.reduce((a, m) => a + m.total, 0);

  return (
    <div className="card">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <PieChart className="h-5 w-5 text-brand-600" /> Recebimentos por forma
      </h3>
      <ul className="space-y-1">
        {data.salesByMethod.map((m) => (
          <li key={m.paymentMethod} className="flex items-center justify-between py-1 text-sm">
            <span className="text-slate-600">
              {methodLabel[m.paymentMethod] ?? m.paymentMethod}
              <span className="ml-1 text-xs text-slate-400">({m.count})</span>
            </span>
            <span className="font-semibold">{brl(m.total)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-bold">
        <span>Total recebido</span>
        <span>{brl(total)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function CashHistory() {
  const [selected, setSelected] = useState<CashRegister | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => api.get<CashRegister[]>('/api/cash/registers'),
  });

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;
  if (selected) {
    return (
      <div className="space-y-4">
        <button className="btn-ghost" onClick={() => setSelected(null)}>
          ← Voltar ao histórico
        </button>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{selected.user?.name ?? 'Operador'}</div>
              <div className="text-xs text-slate-400">
                {new Date(selected.openedAt).toLocaleString('pt-BR')}
                {selected.closedAt && ` → ${new Date(selected.closedAt).toLocaleString('pt-BR')}`}
              </div>
            </div>
            <span className={`badge ${selected.status === 'OPEN' ? 'badge-warning' : 'badge-neutral'}`}>
              {selected.status}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Row label="Fundo inicial" value={brl(selected.initialCash)} />
            {selected.finalCash != null && <Row label="Contado no fechamento" value={brl(selected.finalCash)} />}
          </div>
        </div>
        <RegisterSummary registerId={selected.id} />
        <RegisterMovements registerId={selected.id} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data?.map((r) => (
        <button
          key={r.id}
          onClick={() => setSelected(r)}
          className="card-hover flex w-full items-center justify-between text-left"
        >
          <div>
            <div className="font-semibold">
              {new Date(r.openedAt).toLocaleDateString('pt-BR')}{' '}
              <span className="text-xs font-normal text-slate-400">
                {new Date(r.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-xs text-slate-400">{r.user?.name}</div>
          </div>
          <span className={`badge ${r.status === 'OPEN' ? 'badge-warning' : 'badge-neutral'}`}>{r.status}</span>
        </button>
      ))}
      {data?.length === 0 && <p className="py-10 text-center text-slate-400">Nenhum caixa registrado.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TransactionModal({
  registerId,
  type,
  editing,
  onClose,
  onSaved,
}: {
  registerId: string;
  type: 'SUPPLY' | 'BLEED';
  editing?: { id: string; amount: number; description: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const isSupply = type === 'SUPPLY';

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/api/cash/transactions/${editing.id}`, { amount: Number(amount), description })
        : api.post(`/api/cash/${registerId}/transactions`, { type, amount: Number(amount), description }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  return (
    <Modal title={`${editing ? 'Editar' : isSupply ? 'Suprimento' : 'Sangria'}`} onClose={onClose}>
      <label className="label">Valor (R$)</label>
      <input
        className="input mb-3"
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0,00"
        autoFocus
      />
      <label className="label">Observação</label>
      <input
        className="input mb-4"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Motivo da operação"
        maxLength={200}
      />
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn-primary"
          disabled={save.isPending || !amount || Number(amount) <= 0 || description.trim().length < 1}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}

function CloseModal({
  registerId,
  onClose,
  onClosed,
}: {
  registerId: string;
  onClose: () => void;
  onClosed: (r: { expectedCash: number; difference: number }) => void;
}) {
  const [finalCash, setFinalCash] = useState('');
  const close = useMutation({
    mutationFn: () =>
      api.post<{ expectedCash: number; difference: number }>(`/api/cash/${registerId}/close`, {
        finalCash: Number(finalCash),
      }),
    onSuccess: onClosed,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao fechar'),
  });

  return (
    <Modal title="Fechar caixa" onClose={onClose}>
      <label className="label">Valor contado na gaveta (R$)</label>
      <input
        className="input mb-4"
        type="number"
        inputMode="decimal"
        value={finalCash}
        onChange={(e) => setFinalCash(e.target.value)}
        placeholder="0,00"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-danger" disabled={close.isPending || finalCash === ''} onClick={() => close.mutate()}>
          {close.isPending ? 'Fechando...' : 'Fechar caixa'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'rose' | 'emerald' }) {
  const color = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : '';
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <strong className={color}>{value}</strong>
    </div>
  );
}
