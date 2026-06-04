import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  FileDown,
  PackagePlus,
  Check,
  Plus,
  Trash2,
  Search,
  ListChecks,
  X,
  Pencil,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { XmlImport } from '../components/XmlImport';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

type Tab = 'sugestao' | 'xml' | 'manual' | 'lancadas';

export function PurchasesPage() {
  const [tab, setTab] = useState<Tab>('sugestao');
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

  const tabBtn = (id: Tab) => (tab === id ? 'btn-primary' : 'btn-ghost');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Compras</h1>
        <p className="text-sm text-slate-500">Sugestão de reposição, entrada de notas e compras lançadas.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={tabBtn('sugestao')} onClick={() => setTab('sugestao')}>
          <TrendingUp className="h-5 w-5" /> Sugestão de compra
        </button>
        <button className={tabBtn('xml')} onClick={() => setTab('xml')}>
          <FileDown className="h-5 w-5" /> Importar XML (NFe)
        </button>
        <button className={tabBtn('manual')} onClick={() => setTab('manual')}>
          <PackagePlus className="h-5 w-5" /> Compra manual
        </button>
        <button className={tabBtn('lancadas')} onClick={() => setTab('lancadas')}>
          <ListChecks className="h-5 w-5" /> Compras lançadas
        </button>
      </div>

      {tab === 'sugestao' && (
        <>
          <div className="card flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-500">Janela de vendas</span>
              <select className="input" value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
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
            <p className="py-8 text-center text-slate-400">Nenhuma reposição sugerida para os parâmetros atuais.</p>
          )}
        </>
      )}

      {tab === 'xml' && <XmlImport />}
      {tab === 'manual' && <ManualPurchase />}
      {tab === 'lancadas' && <PurchasesList />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compra manual (multi-produto)
// ---------------------------------------------------------------------------
interface SupplierLite {
  id: string;
  name: string;
}
interface PItem {
  variantId: string;
  label: string;
  currentSalePrice: number;
  quantity: number;
  unitCost: number;
  newSalePrice: string; // vazio = manter
  tracksLot: boolean;
  batch: string;
  validity: string;
}

function ManualPurchase() {
  const qc = useQueryClient();
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PItem[]>([]);
  const [genPayable, setGenPayable] = useState(false);
  const [parcels, setParcels] = useState(1);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', supplierName],
    queryFn: () =>
      api.get<{ items: SupplierLite[] }>(`/api/persons?type=SUPPLIER&search=${encodeURIComponent(supplierName)}`),
    enabled: supplierName.trim().length >= 2 && !supplierId,
  });

  const total = round2(items.reduce((a, it) => a + it.quantity * it.unitCost, 0));

  function genInstallments() {
    const n = Math.max(1, Math.floor(parcels));
    const base = Math.floor((total / n) * 100) / 100;
    const parts: { dueDate: string; amount: number }[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(total - acc) : base;
      acc = round2(acc + amount);
      const d = new Date(firstDue);
      d.setDate(d.getDate() + i * intervalDays);
      parts.push({ dueDate: d.toISOString().slice(0, 10), amount });
    }
    return parts;
  }

  function setItem(variantId: string, patch: Partial<PItem>) {
    setItems((prev) => prev.map((it) => (it.variantId === variantId ? { ...it, ...patch } : it)));
  }

  const save = useMutation({
    mutationFn: () =>
      api.post('/api/invoices/manual', {
        supplierId: supplierId ?? undefined,
        supplierName: supplierId ? undefined : supplierName.trim(),
        purchaseDate,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
          unitCost: it.unitCost,
          newSalePrice: it.newSalePrice.trim() ? Number(it.newSalePrice) : undefined,
          tracksLotValidity: it.tracksLot,
          batch: it.batch || undefined,
          validity: it.validity || undefined,
        })),
        installments: genPayable ? genInstallments() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['financial'] });
      setDone(true);
      setItems([]);
      setNotes('');
      setGenPayable(false);
      window.setTimeout(() => setDone(false), 3000);
    },
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : 'Falha ao registrar'),
  });

  function submit() {
    setLocalError(null);
    if (!supplierId && supplierName.trim().length < 1) return setLocalError('Informe o fornecedor.');
    if (items.length === 0) return setLocalError('Adicione ao menos um produto.');
    for (const it of items) {
      if (it.quantity <= 0 || it.unitCost < 0) return setLocalError('Quantidade/custo inválidos.');
      if (it.tracksLot && (!it.batch.trim() || !it.validity))
        return setLocalError(`Lote/validade obrigatórios em "${it.label}".`);
    }
    save.mutate();
  }

  return (
    <div className="card max-w-3xl space-y-4">
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
            <span className="mt-1 inline-block text-xs text-amber-600">Será cadastrado como novo fornecedor</span>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Data da compra *</span>
          <input className="input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Observação</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </label>
      </div>

      {/* Itens */}
      <div>
        <span className="label">Produtos *</span>
        <ProductSearch
          onPick={(v) =>
            setItems((prev) =>
              prev.some((p) => p.variantId === v.id)
                ? prev
                : [
                    ...prev,
                    {
                      variantId: v.id,
                      label: v.label,
                      currentSalePrice: v.salePrice,
                      quantity: 1,
                      unitCost: v.costPrice,
                      newSalePrice: '',
                      tracksLot: false,
                      batch: '',
                      validity: '',
                    },
                  ],
            )
          }
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.variantId} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{it.label}</span>
                <button
                  className="text-slate-300 hover:text-rose-500"
                  onClick={() => setItems((prev) => prev.filter((p) => p.variantId !== it.variantId))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Num label="Qtd" value={it.quantity} onChange={(v) => setItem(it.variantId, { quantity: v })} />
                <Num label="Custo (R$)" value={it.unitCost} step="0.01" onChange={(v) => setItem(it.variantId, { unitCost: v })} />
                <label className="block">
                  <span className="label">Novo preço venda</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={it.newSalePrice}
                    onChange={(e) => setItem(it.variantId, { newSalePrice: e.target.value })}
                    placeholder={`atual ${brl(it.currentSalePrice)}`}
                  />
                </label>
                <label className="flex items-end gap-2 pb-1 text-xs">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-600"
                    checked={it.tracksLot}
                    onChange={(e) => setItem(it.variantId, { tracksLot: e.target.checked })}
                  />
                  Lote/validade
                </label>
              </div>
              {it.tracksLot && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="label">Lote *</span>
                    <input className="input" value={it.batch} onChange={(e) => setItem(it.variantId, { batch: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">Validade *</span>
                    <input
                      className="input"
                      type="date"
                      value={it.validity}
                      onChange={(e) => setItem(it.variantId, { validity: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-2 font-semibold">
            <span>Total da compra</span>
            <span>{brl(total)}</span>
          </div>
        </div>
      )}

      {/* Contas a pagar (D7) */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-brand-600"
          checked={genPayable}
          onChange={(e) => setGenPayable(e.target.checked)}
        />
        <span className="text-sm">
          <span className="font-semibold text-slate-700">Gerar contas a pagar</span>
          <span className="block text-xs text-slate-500">Cria os títulos a pagar do total da compra, com parcelas.</span>
        </span>
      </label>

      {genPayable && (
        <div className="grid grid-cols-3 gap-2">
          <Num label="Parcelas" value={parcels} onChange={(v) => setParcels(v || 1)} />
          <label className="block">
            <span className="label">1º vencimento</span>
            <input className="input" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
          </label>
          <Num label="Intervalo (dias)" value={intervalDays} onChange={(v) => setIntervalDays(v || 30)} />
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
            <Check className="h-4 w-4" /> Compra registrada!
          </span>
        )}
        <button className="btn-primary" disabled={save.isPending} onClick={submit}>
          {save.isPending ? 'Salvando...' : 'Registrar compra'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compras lançadas
// ---------------------------------------------------------------------------
interface InvoiceListItem {
  id: string;
  documentNumber: number | null;
  notes: string | null;
  issueDate: string;
  totalAmount: number;
  supplier: { name: string };
  items: Array<{ id: string }>;
}

function PurchasesList() {
  const qc = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<{ items: InvoiceListItem[] }>('/api/invoices?pageSize=100'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  if (isLoading) return <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="py-2">Doc.</th>
            <th>Fornecedor</th>
            <th>Data</th>
            <th className="text-center">Itens</th>
            <th className="text-right">Total</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.items.map((inv) => (
            <tr key={inv.id}>
              <td className="py-2 font-medium">{inv.documentNumber ? `#${inv.documentNumber}` : '—'}</td>
              <td>
                {inv.supplier.name}
                {inv.notes && <div className="text-xs text-slate-400">{inv.notes}</div>}
              </td>
              <td>{new Date(inv.issueDate).toLocaleDateString('pt-BR')}</td>
              <td className="text-center">{inv.items.length}</td>
              <td className="text-right font-semibold">{brl(inv.totalAmount)}</td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    onClick={() => setDetailId(inv.id)}
                    title="Detalhes / editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => {
                      if (window.confirm('Excluir esta compra? O estoque será estornado.')) remove.mutate(inv.id);
                    }}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {data?.items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 text-center text-slate-400">
                Nenhuma compra lançada.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {detailId && <PurchaseDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function PurchaseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const inv = await api.get<{
        documentNumber: number | null;
        notes: string | null;
        issueDate: string;
        totalAmount: number;
        supplier: { name: string };
        items: Array<{ id: string; quantity: number; unitCost: number; variant: { description: string; product: { name: string } } }>;
        financialAccounts: Array<{ id: string; description: string; amount: number; dueDate: string; status: string }>;
      }>(`/api/invoices/${id}`);
      setNotes(inv.notes ?? '');
      return inv;
    },
  });

  const save = useMutation({
    mutationFn: () => api.put(`/api/invoices/${id}`, { notes: notes.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onClose();
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg animate-scale-in overflow-auto rounded-2xl bg-white p-5 shadow-elevated">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            Compra {data?.documentNumber ? `#${data.documentNumber}` : ''}
          </h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="grid h-24 place-items-center text-slate-500">Carregando...</div>
        ) : (
          <>
            <div className="mb-2 text-sm text-slate-500">
              {data.supplier.name} · {new Date(data.issueDate).toLocaleDateString('pt-BR')}
            </div>
            <ul className="mb-3 divide-y divide-slate-100 text-sm">
              {data.items.map((it) => (
                <li key={it.id} className="flex justify-between py-1.5">
                  <span>
                    {it.variant.product.name} — {it.variant.description}
                  </span>
                  <span className="text-slate-500">
                    {it.quantity} × {brl(it.unitCost)}
                  </span>
                </li>
              ))}
            </ul>
            {data.financialAccounts.length > 0 && (
              <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
                <div className="mb-1 font-semibold">Contas a pagar</div>
                {data.financialAccounts.map((a) => (
                  <div key={a.id} className="flex justify-between text-slate-600">
                    <span>
                      {new Date(a.dueDate).toLocaleDateString('pt-BR')} · {a.status}
                    </span>
                    <span>{brl(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <span>Total</span>
              <span>{brl(data.totalAmount)}</span>
            </div>

            <label className="mt-3 block">
              <span className="label">Observação</span>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={onClose}>
                Fechar
              </button>
              <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
                Salvar observação
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
interface VariantHit {
  id: string;
  label: string;
  salePrice: number;
  costPrice: number;
}

function ProductSearch({ onPick }: { onPick: (v: VariantHit) => void }) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['manual-product-search', term],
    queryFn: () =>
      api.get<{
        items: Array<{
          name: string;
          variants: Array<{ id: string; description: string; sku: string; salePrice: number; costPrice: number }>;
        }>;
      }>(`/api/products?search=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
  });

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-9"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar produto cadastrado para adicionar..."
      />
      {data && term.trim().length >= 2 && (
        <div className="mt-1 max-h-44 overflow-auto rounded-xl border border-slate-200">
          {data.items.flatMap((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onPick({
                    id: v.id,
                    label: `${p.name} — ${v.description} (${v.sku})`,
                    salePrice: v.salePrice,
                    costPrice: v.costPrice,
                  });
                  setTerm('');
                }}
              >
                {p.name} — {v.description} <span className="text-slate-400">({v.sku})</span>
              </button>
            )),
          )}
          {data.items.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Nenhum produto encontrado.</div>}
        </div>
      )}
    </div>
  );
}

function Num({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        type="number"
        step={step ?? '1'}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
