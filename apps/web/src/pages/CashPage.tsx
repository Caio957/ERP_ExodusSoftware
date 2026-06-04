import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, PlusCircle, MinusCircle, Lock, Clock, Scale } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface CashRegister {
  id: string;
  initialCash: number;
  expectedCash?: number;
  openedAt: string;
  status: string;
  transactions?: Array<{ id: string; type: string; amount: number; description: string }>;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CashPage() {
  const qc = useQueryClient();
  const [initialCash, setInitialCash] = useState('');
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

  const transaction = useMutation({
    mutationFn: (input: { type: 'SUPPLY' | 'BLEED'; amount: number; description: string }) =>
      api.post(`/api/cash/${register!.id}/transactions`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-current'] }),
  });

  const close = useMutation({
    mutationFn: (finalCash: number) =>
      api.post<{ expectedCash: number; difference: number }>(`/api/cash/${register!.id}/close`, {
        finalCash,
      }),
    onSuccess: (data) => {
      setCloseResult(data);
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
  });

  function handleTransaction(type: 'SUPPLY' | 'BLEED') {
    const value = Number(window.prompt(`Valor do ${type === 'SUPPLY' ? 'suprimento' : 'sangria'}:`));
    if (!value || value <= 0) return;
    const description = window.prompt('Descrição:') ?? '';
    transaction.mutate({ type, amount: value, description: description || type });
  }

  function handleClose() {
    const finalCash = Number(window.prompt('Valor contado na gaveta (fechamento):'));
    if (Number.isNaN(finalCash)) return;
    close.mutate(finalCash);
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  if (!register) {
    return (
      <div className="mx-auto max-w-md">
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
          <button
            className="btn-primary w-full"
            disabled={!initialCash || open.isPending}
            onClick={() => open.mutate()}
          >
            {open.isPending ? 'Abrindo...' : 'Abrir caixa'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Cartão de destaque do caixa */}
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
            <div className="mt-1 text-sm text-white/70">
              Fundo inicial: {brl(register.initialCash)}
            </div>
          </div>
          <span className="badge bg-white/20 text-white ring-1 ring-white/30">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {register.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost py-6 text-base" onClick={() => handleTransaction('SUPPLY')}>
          <PlusCircle className="h-5 w-5 text-emerald-600" /> Suprimento
        </button>
        <button className="btn-ghost py-6 text-base" onClick={() => handleTransaction('BLEED')}>
          <MinusCircle className="h-5 w-5 text-rose-600" /> Sangria
        </button>
      </div>

      <button className="btn-danger w-full py-5 text-base" onClick={handleClose}>
        <Lock className="h-5 w-5" /> Fechar caixa
      </button>

      {register.transactions && register.transactions.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold">Movimentações</h3>
          <ul className="space-y-1">
            {register.transactions.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  {t.type === 'SUPPLY' ? (
                    <PlusCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <MinusCircle className="h-4 w-4 text-rose-600" />
                  )}
                  {t.description}
                </span>
                <span className={`font-semibold ${t.type === 'SUPPLY' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'SUPPLY' ? '+' : '−'}
                  {brl(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {closeResult && (
        <div className="card animate-scale-in border-2 border-brand-200">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Scale className="h-5 w-5 text-brand-600" /> Resumo do fechamento
          </h3>
          <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
            <span className="text-slate-500">Esperado em caixa</span>
            <strong>{brl(closeResult.expectedCash)}</strong>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-slate-500">Diferença</span>
            <strong className={closeResult.difference < 0 ? 'text-rose-600' : 'text-emerald-600'}>
              {brl(closeResult.difference)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
