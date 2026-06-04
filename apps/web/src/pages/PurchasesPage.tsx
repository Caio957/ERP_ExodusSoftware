import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, FileDown, PackagePlus, Check } from 'lucide-react';
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
  const [tab, setTab] = useState<'sugestao' | 'xml' | 'manual'>('sugestao');
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
        <button
          className={tab === 'manual' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setTab('manual')}
        >
          <PackagePlus className="h-5 w-5" /> Compra manual
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

      {tab === 'manual' && <ManualPurchase />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cadastro manual de compra (sem XML)
// ---------------------------------------------------------------------------
interface SupplierLite {
  id: string;
  name: string;
}
interface VariantHit {
  id: string;
  label: string;
}

function ManualPurchase() {
  const qc = useQueryClient();
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [variant, setVariant] = useState<VariantHit | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [tracksLot, setTracksLot] = useState(false);
  const [batch, setBatch] = useState('');
  const [validity, setValidity] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', supplierName],
    queryFn: () =>
      api.get<{ items: SupplierLite[] }>(
        `/api/persons?type=SUPPLIER&search=${encodeURIComponent(supplierName)}`,
      ),
    enabled: supplierName.trim().length >= 2 && !supplierId,
  });

  const save = useMutation({
    mutationFn: () =>
      api.post('/api/invoices/manual', {
        supplierId: supplierId ?? undefined,
        supplierName: supplierId ? undefined : supplierName.trim(),
        purchaseDate,
        variantId: variant?.id,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        tracksLotValidity: tracksLot,
        batch: batch || undefined,
        validity: validity || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setDone(true);
      setVariant(null);
      setQuantity('1');
      setUnitCost('0');
      setBatch('');
      setValidity('');
      setTracksLot(false);
      window.setTimeout(() => setDone(false), 3000);
    },
  });

  function submit() {
    setLocalError(null);
    if (!supplierId && supplierName.trim().length < 1) {
      setLocalError('Informe o fornecedor.');
      return;
    }
    if (!variant) {
      setLocalError('Selecione o produto.');
      return;
    }
    if (Number(quantity) <= 0) {
      setLocalError('Quantidade deve ser maior que zero.');
      return;
    }
    if (tracksLot && (!batch.trim() || !validity)) {
      setLocalError('Lote e validade são obrigatórios quando o controle está ativado.');
      return;
    }
    save.mutate();
  }

  return (
    <div className="card max-w-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold">
        <PackagePlus className="h-5 w-5 text-brand-600" /> Nova compra manual
      </div>

      {/* Fornecedor */}
      <div className="relative">
        <span className="label">Fornecedor *</span>
        <input
          className="input"
          value={supplierName}
          onChange={(e) => {
            setSupplierName(e.target.value);
            setSupplierId(null);
          }}
          placeholder="Buscar ou digitar um novo fornecedor..."
        />
        {!supplierId && supplierName.trim().length >= 2 && suppliers && suppliers.items.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
            {suppliers.items.map((s) => (
              <button
                key={s.id}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setSupplierId(s.id);
                  setSupplierName(s.name);
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        {supplierId ? (
          <span className="mt-1 inline-block text-xs text-emerald-600">✓ Fornecedor existente</span>
        ) : (
          supplierName.trim().length >= 1 && (
            <span className="mt-1 inline-block text-xs text-amber-600">
              Será cadastrado como novo fornecedor
            </span>
          )
        )}
      </div>

      {/* Produto */}
      <div>
        <span className="label">Produto *</span>
        {variant ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <span>{variant.label}</span>
            <button className="text-xs underline" onClick={() => setVariant(null)}>
              trocar
            </button>
          </div>
        ) : (
          <ProductSearch onPick={(v) => setVariant(v)} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Data da compra *</span>
          <input
            className="input"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Quantidade *</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Preço de compra (R$) *</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-brand-600"
          checked={tracksLot}
          onChange={(e) => setTracksLot(e.target.checked)}
        />
        <span className="text-sm">
          <span className="font-semibold text-slate-700">Controlar lote e validade</span>
          <span className="block text-xs text-slate-500">
            Registra lote/validade desta entrada e marca o produto.
          </span>
        </span>
      </label>

      {tracksLot && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Lote *</span>
            <input className="input" value={batch} onChange={(e) => setBatch(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Validade *</span>
            <input
              className="input"
              type="date"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
            />
          </label>
        </div>
      )}

      {(localError || save.error instanceof ApiError) && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {localError ?? (save.error as ApiError).message}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {done && (
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Entrada registrada!
          </span>
        )}
        <button className="btn-primary" disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Salvando...' : 'Registrar compra'}
        </button>
      </div>
    </div>
  );
}

/** Busca de produto para selecionar a variante da compra manual. */
function ProductSearch({ onPick }: { onPick: (v: VariantHit) => void }) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['manual-product-search', term],
    queryFn: () =>
      api.get<{
        items: Array<{ name: string; variants: Array<{ id: string; description: string; sku: string }> }>;
      }>(`/api/products?search=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
  });

  return (
    <div>
      <input
        className="input"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar produto cadastrado..."
      />
      {data && term.trim().length >= 2 && (
        <div className="mt-1 max-h-44 overflow-auto rounded-xl border border-slate-200">
          {data.items.flatMap((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => onPick({ id: v.id, label: `${p.name} — ${v.description} (${v.sku})` })}
              >
                {p.name} — {v.description} <span className="text-slate-400">({v.sku})</span>
              </button>
            )),
          )}
          {data.items.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">Nenhum produto encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
