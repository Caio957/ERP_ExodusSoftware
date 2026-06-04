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
} from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type AccountType = 'PAYABLE' | 'RECEIVABLE';

interface Account {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  invoiceId?: string | null;
  person?: { name: string } | null;
}

export function FinancialPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<AccountType>('PAYABLE');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['financial', type],
    queryFn: () => api.get<{ items: Account[] }>(`/api/financial?type=${type}&pageSize=100`),
  });

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/api/financial/${id}/pay`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/financial/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  function handleDelete(a: Account) {
    if (window.confirm(`Excluir o lançamento "${a.description}"?`)) remove.mutate(a.id);
  }

  const totalPending =
    data?.items.filter((a) => a.status !== 'PAID').reduce((acc, a) => acc + a.amount, 0) ?? 0;

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
          <button
            className={type === 'PAYABLE' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setType('PAYABLE')}
          >
            <ArrowUpCircle className="h-5 w-5" /> A Pagar
          </button>
          <button
            className={type === 'RECEIVABLE' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setType('RECEIVABLE')}
          >
            <ArrowDownCircle className="h-5 w-5" /> A Receber
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-soft">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Total pendente
          </div>
          <div className={`text-xl font-bold ${type === 'PAYABLE' ? 'text-rose-600' : 'text-emerald-600'}`}>
            {brl(totalPending)}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">Descrição</th>
                <th>Pessoa</th>
                <th>Vencimento</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((a) => {
                const locked = !!a.invoiceId;
                return (
                  <tr key={a.id}>
                    <td className="py-2">
                      <span className="flex items-center gap-1.5">
                        {locked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                        {a.description}
                      </span>
                    </td>
                    <td className="text-slate-500">{a.person?.name ?? '—'}</td>
                    <td>{new Date(a.dueDate).toLocaleDateString('pt-BR')}</td>
                    <td className="text-right font-medium">{brl(a.amount)}</td>
                    <td>
                      <StatusTag status={a.status} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {a.status !== 'PAID' && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            onClick={() => pay.mutate(a.id)}
                            title="Dar baixa"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Baixar
                          </button>
                        )}
                        {locked ? (
                          <span
                            className="grid h-8 w-8 place-items-center text-slate-300"
                            title="Originado de nota/entrada — protegido"
                          >
                            <Lock className="h-4 w-4" />
                          </span>
                        ) : (
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
                              onClick={() => handleDelete(a)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum lançamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <NewEntryModal
          initialType={type}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['financial'] });
          }}
        />
      )}

      {editing && (
        <EditEntryModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['financial'] });
          }}
        />
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
  const [localError, setLocalError] = useState<string | null>(null);

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
      }),
    onSuccess: onCreated,
  });

  function submit() {
    setLocalError(null);
    if (description.trim().length < 1) return setLocalError('Informe a descrição.');
    if (Number(totalAmount) <= 0) return setLocalError('Valor total deve ser maior que zero.');
    create.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-scale-in rounded-2xl bg-white p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Novo lançamento</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            className={type === 'PAYABLE' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setType('PAYABLE')}
          >
            <ArrowUpCircle className="h-5 w-5" /> A Pagar
          </button>
          <button
            className={type === 'RECEIVABLE' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setType('RECEIVABLE')}
          >
            <ArrowDownCircle className="h-5 w-5" /> A Receber
          </button>
        </div>

        <label className="block">
          <span className="label">Descrição *</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Valor total (R$) *</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">1º vencimento *</span>
            <input
              className="input"
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Nº de parcelas *</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Intervalo (dias)</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
            />
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
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={create.isPending} onClick={submit}>
            {create.isPending ? 'Salvando...' : 'Lançar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function EditEntryModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(account.description);
  const [amount, setAmount] = useState(String(account.amount));
  const [dueDate, setDueDate] = useState(account.dueDate.slice(0, 10));

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/financial/${account.id}`, {
        description,
        amount: Number(amount),
        dueDate,
      }),
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Editar lançamento</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block">
          <span className="label">Descrição</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Valor (R$)</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Vencimento</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        {save.error instanceof ApiError && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {save.error.message}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'bg-emerald-100 text-emerald-700',
    PENDING: 'bg-amber-100 text-amber-700',
    LATE: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-slate-100'}`}>
      {status}
    </span>
  );
}
