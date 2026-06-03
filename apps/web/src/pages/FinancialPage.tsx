import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Account {
  id: string;
  type: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  person?: { name: string } | null;
}

export function FinancialPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');

  const { data, isLoading } = useQuery({
    queryKey: ['financial', type],
    queryFn: () => api.get<{ items: Account[] }>(`/api/financial?type=${type}&pageSize=100`),
  });

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/api/financial/${id}/pay`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  });

  const totalPending =
    data?.items.filter((a) => a.status !== 'PAID').reduce((acc, a) => acc + a.amount, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Financeiro</h1>
        <p className="text-sm text-slate-500">Contas a pagar e a receber da loja.</p>
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
        <div className="p-8 text-center text-slate-500">Carregando...</div>
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
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">{a.description}</td>
                  <td className="text-slate-500">{a.person?.name ?? '—'}</td>
                  <td>{new Date(a.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td className="text-right font-medium">{brl(a.amount)}</td>
                  <td>
                    <StatusTag status={a.status} />
                  </td>
                  <td className="text-right">
                    {a.status !== 'PAID' && (
                      <button
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        onClick={() => pay.mutate(a.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Dar baixa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
