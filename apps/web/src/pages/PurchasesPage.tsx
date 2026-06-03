import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, FileDown } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { XmlImport } from '../components/XmlImport';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Suggestion {
  variantId: string;
  sku: string;
  description: string;
  productName: string;
  brand: string;
  stockQty: number;
  soldInWindow: number;
  avgPerDay: number;
  suggestedQty: number;
}

export function PurchasesPage() {
  const [tab, setTab] = useState<'sugestao' | 'xml'>('sugestao');
  const [windowDays, setWindowDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(15);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suggestions', windowDays, leadTimeDays],
    queryFn: () =>
      api.get<{ suggestions: Suggestion[] }>(
        `/api/purchase-suggestions?windowDays=${windowDays}&leadTimeDays=${leadTimeDays}`,
      ),
    enabled: tab === 'sugestao',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Compras</h1>
        <p className="text-sm text-slate-500">Sugestão de reposição e entrada de notas fiscais.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={tab === 'sugestao' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('sugestao')}
        >
          <TrendingUp className="h-5 w-5" /> Sugestão de compra
        </button>
        <button className={tab === 'xml' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('xml')}>
          <FileDown className="h-5 w-5" /> Importar XML (NFe)
        </button>
      </div>

      {tab === 'sugestao' && (
        <>
          <div className="card flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-500">Janela de vendas</span>
              <select
                className="input"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
              >
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-500">Tempo de reposição (dias)</span>
              <input
                className="input"
                type="number"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
              />
            </label>
          </div>

          {error instanceof ApiError && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error.message}</div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Calculando...</div>
          ) : data && data.suggestions.length > 0 ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-2">Produto</th>
                    <th>SKU</th>
                    <th className="text-right">Estoque</th>
                    <th className="text-right">Vendas</th>
                    <th className="text-right">Média/dia</th>
                    <th className="text-right">Sugerido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.suggestions.map((s) => (
                    <tr key={s.variantId}>
                      <td className="py-2">
                        <div className="font-medium">{s.productName}</div>
                        <div className="text-xs text-slate-400">
                          {s.brand} · {s.description}
                        </div>
                      </td>
                      <td className="text-slate-500">{s.sku}</td>
                      <td className="text-right">{s.stockQty}</td>
                      <td className="text-right">{s.soldInWindow}</td>
                      <td className="text-right">{s.avgPerDay}</td>
                      <td className="text-right text-base font-bold text-brand-700">+{s.suggestedQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-slate-400">
              Nenhuma reposição sugerida para os parâmetros atuais.
            </p>
          )}
        </>
      )}

      {tab === 'xml' && <XmlImport />}
    </div>
  );
}
