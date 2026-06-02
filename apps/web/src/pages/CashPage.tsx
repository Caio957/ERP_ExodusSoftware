import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';

interface CashRegister {
  id: string;
  initialCash: number;
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
      <div className="card mx-auto max-w-md">
        <h2 className="mb-1 text-lg font-bold">Abrir caixa</h2>
        <p className="mb-4 text-sm text-slate-500">Informe o valor inicial (fundo de troco).</p>
        <input
          className="input mb-3 text-lg"
          type="number"
          inputMode="decimal"
          value={initialCash}
          onChange={(e) => setInitialCash(e.target.value)}
          placeholder="0,00"
        />
        {open.error instanceof ApiError && (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Caixa aberto</h2>
            <p className="text-sm text-slate-500">
              Desde {new Date(register.openedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            {register.status}
          </span>
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Fundo inicial: <strong>{brl(register.initialCash)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn-ghost py-6 text-base" onClick={() => handleTransaction('SUPPLY')}>
          ➕ Suprimento
        </button>
        <button className="btn-ghost py-6 text-base" onClick={() => handleTransaction('BLEED')}>
          ➖ Sangria
        </button>
      </div>

      <button className="btn-danger w-full py-5 text-base" onClick={handleClose}>
        🔒 Fechar caixa
      </button>

      {register.transactions && register.transactions.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-semibold">Movimentações</h3>
          <ul className="divide-y divide-slate-100">
            {register.transactions.map((t) => (
              <li key={t.id} className="flex justify-between py-2 text-sm">
                <span>
                  {t.type === 'SUPPLY' ? '➕' : '➖'} {t.description}
                </span>
                <span className={t.type === 'SUPPLY' ? 'text-emerald-600' : 'text-rose-600'}>
                  {brl(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {closeResult && (
        <div className="card border-2 border-brand-200">
          <h3 className="mb-2 font-semibold">Resumo do fechamento</h3>
          <div className="flex justify-between text-sm">
            <span>Esperado em caixa</span>
            <strong>{brl(closeResult.expectedCash)}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span>Diferença</span>
            <strong className={closeResult.difference < 0 ? 'text-rose-600' : 'text-emerald-600'}>
              {brl(closeResult.difference)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
