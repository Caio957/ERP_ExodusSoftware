import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, ShoppingBag, Wallet, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { api } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const methodLabel: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  A_PRAZO: 'A prazo',
  SPLIT: 'Múltiplas',
};

interface DashboardData {
  salesTotal: number;
  salesCount: number;
  ticket: number;
  byMethod: Array<{ method: string; total: number }>;
  dailySales: Array<{ date: string; total: number }>;
  payableOpen: number;
  receivableOpen: number;
  payableOverdue: number;
  receivableOverdue: number;
  incomeTotal: number;
  expensesTotal: number;
  monthResult: number;
}

export function DashboardPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return iso(d);
  });
  const [to, setTo] = useState(() => iso(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () => api.get<DashboardData>(`/api/dashboard?from=${from}&to=${to}`),
  });

  function preset(days: number) {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - (days - 1));
    setFrom(iso(f));
    setTo(iso(t));
  }

  const maxDaily = Math.max(1, ...(data?.dailySales.map((d) => d.total) ?? [1]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <LineChart className="h-6 w-6" />
          </span>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="text-sm text-slate-500">Visão financeira do período.</p>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">De</span>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Até</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="flex gap-1">
          <button className="btn-ghost h-10 px-3 text-sm" onClick={() => preset(1)}>Hoje</button>
          <button className="btn-ghost h-10 px-3 text-sm" onClick={() => preset(7)}>7 dias</button>
          <button className="btn-ghost h-10 px-3 text-sm" onClick={() => preset(30)}>30 dias</button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi icon={ShoppingBag} label="Vendas no período" value={brl(data.salesTotal)} sub={`${data.salesCount} venda(s)`} tone="brand" />
            <Kpi icon={Wallet} label="Ticket médio" value={brl(data.ticket)} tone="slate" />
            <Kpi
              icon={ArrowDownCircle}
              label="A receber em aberto"
              value={brl(data.receivableOpen)}
              sub={data.receivableOverdue > 0 ? `${brl(data.receivableOverdue)} vencido` : 'em dia'}
              tone="emerald"
            />
          </div>

          {/* Resultado do período: Receitas − Despesas (saldo +/−) */}
          <div className="card">
            <h3 className="mb-3 font-semibold">Resultado do período (Receitas − Despesas)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Receitas (vendas)</div>
                <div className="font-display text-xl font-bold text-emerald-700">{brl(data.incomeTotal)}</div>
              </div>
              <div className="rounded-xl bg-rose-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-rose-700">Despesas (contas a pagar)</div>
                <div className="font-display text-xl font-bold text-rose-700">{brl(data.expensesTotal)}</div>
              </div>
              <div className={`rounded-xl p-4 ${data.monthResult >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                <div
                  className={`text-xs font-medium uppercase tracking-wide ${data.monthResult >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                >
                  Saldo do período
                </div>
                <div
                  className={`font-display text-xl font-bold ${data.monthResult >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}
                >
                  {brl(data.monthResult)}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Receitas = vendas no período. Despesas = contas a pagar com vencimento no período.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Série diária */}
            <div className="card">
              <h3 className="mb-3 font-semibold">Vendas por dia</h3>
              {data.dailySales.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <div className="flex h-40 items-end gap-1">
                  {data.dailySales.map((d) => (
                    <div
                      key={d.date}
                      className="group flex h-full flex-1 flex-col items-center justify-end"
                      title={`${new Date(`${d.date}T00:00:00`).toLocaleDateString('pt-BR')}: ${brl(d.total)}`}
                    >
                      <div
                        className="w-full rounded-t bg-brand-gradient transition-all group-hover:opacity-80"
                        style={{ height: `${Math.max(4, (d.total / maxDaily) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recebimentos por forma */}
            <div className="card">
              <h3 className="mb-3 font-semibold">Recebimentos por forma</h3>
              {data.byMethod.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Sem recebimentos no período.</p>
              ) : (
                <ul className="space-y-2">
                  {data.byMethod.map((m) => (
                    <li key={m.method} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{methodLabel[m.method] ?? m.method}</span>
                      <span className="font-semibold">{brl(m.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Situação financeira */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card">
              <div className="flex items-center gap-2 font-semibold text-rose-600">
                <ArrowUpCircle className="h-5 w-5" /> Contas a pagar
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-500">Em aberto</span>
                <strong>{brl(data.payableOpen)}</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Vencido</span>
                <strong className="text-rose-600">{brl(data.payableOverdue)}</strong>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 font-semibold text-emerald-600">
                <ArrowDownCircle className="h-5 w-5" /> Contas a receber
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-500">Em aberto</span>
                <strong>{brl(data.receivableOpen)}</strong>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Vencido</span>
                <strong className="text-rose-600">{brl(data.receivableOverdue)}</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  sub?: string;
  tone: 'brand' | 'emerald' | 'slate';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-gradient text-white shadow-brand',
    emerald: 'bg-emerald-500 text-white shadow-soft',
    slate: 'bg-slate-800 text-white shadow-soft',
  };
  return (
    <div className="card-hover flex items-center gap-3">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-display text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}
