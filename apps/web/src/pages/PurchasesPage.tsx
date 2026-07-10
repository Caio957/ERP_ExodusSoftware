import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Eye,
  Filter,
  ShoppingCart,
  RotateCcw,
  ShieldAlert,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from 'lucide-react';
import {
  type ProductFormSettings,
  priceFromMargin,
  priceFromMarkup,
  marginFromPrice,
  markupFromPrice,
} from '@exodus/shared';
import { api, ApiError } from '../lib/api';
import { XmlImport } from '../components/XmlImport';
import { PurchaseFinancialEngine, type PurchaseInstallment } from '../components/PurchaseFinancialEngine';
import { useSearchHandler } from '../hooks/useSearchHandler';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Padrão BR de vírgula decimal (mesmo helper usado em PDV/Vendas/Produtos/XmlImport).
function sanitizeBr(s: string): string {
  let v = s.replace(/\./g, ',');
  v = v.replace(/[^\d,]/g, '');
  v = v.replace(/^,/, '');
  const parts = v.split(',');
  if (parts.length > 1) v = parts[0] + ',' + parts.slice(1).join('');
  return v.replace(/^0+(?=\d)/, '');
}

// Datas vindas do backend já são ISO completo (ex: 2026-07-09T00:00:00.000Z)
// — concatenar "T00:00:00" de novo (como o código antigo fazia) produz
// "Invalid Date". Mesmo padrão de blindagem usado em XmlImport.tsx.
function fmtDate(s: string): string {
  if (!s) return '—';
  const date = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

// Extrai YYYY-MM-DD a partir de um ISO que representa um campo "data pura"
// (persistido como meia-noite UTC) usando getters UTC — getters locais
// sofreriam shift de um dia em fusos negativos (Brasil, UTC-3).
function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface Suggestion {
  variantId: string;
  sku: string;
  description: string;
  productName: string;
  brand: string;
  group: string;
  subgroup?: string | null;
  stockQty: number;
  soldInWindow: number;
  avgPerDay: number;
  suggestedQty: number;
  lastCost?: number;
}

type Tab = 'sugestao' | 'xml' | 'manual' | 'lancadas';

export function PurchasesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('sugestao');
  const [windowDays, setWindowDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(15);
  const [suggBrand, setSuggBrand] = useState('');
  const [suggGroup, setSuggGroup] = useState('');
  const [suggSubgroup, setSuggSubgroup] = useState('');
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suggestions', windowDays, leadTimeDays, suggBrand, suggGroup, suggSubgroup],
    queryFn: () => {
      const qs = new URLSearchParams({ windowDays: String(windowDays), leadTimeDays: String(leadTimeDays) });
      if (suggBrand.trim()) qs.set('brand', suggBrand.trim());
      if (suggGroup.trim()) qs.set('group', suggGroup.trim());
      if (suggSubgroup.trim()) qs.set('subgroup', suggSubgroup.trim());
      return api.get<{ suggestions: Suggestion[] }>(`/api/purchase-suggestions?${qs.toString()}`);
    },
    enabled: tab === 'sugestao',
  });

  const tabBtn = (id: Tab) => (tab === id ? 'btn-primary' : 'btn-ghost');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
          <ShoppingCart className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Compras</h1>
          <p className="text-sm text-slate-500">Sugestão de reposição, entrada de notas e compras lançadas.</p>
        </div>
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
          <div className="card space-y-3">
            <div className="flex flex-wrap items-end gap-4">
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
                  value={leadTimeDays === 0 ? '' : leadTimeDays}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^0+/, '');
                    setLeadTimeDays(val === '' ? 0 : Number(val));
                  }}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="label">Marca (filtro)</span>
                <input className="input h-10 text-sm" value={suggBrand} onChange={(e) => setSuggBrand(e.target.value)} placeholder="Todas" />
              </label>
              <label className="block">
                <span className="label">Grupo (filtro)</span>
                <input className="input h-10 text-sm" value={suggGroup} onChange={(e) => setSuggGroup(e.target.value)} placeholder="Todos" />
              </label>
              <label className="block">
                <span className="label">Subgrupo (filtro)</span>
                <input className="input h-10 text-sm" value={suggSubgroup} onChange={(e) => setSuggSubgroup(e.target.value)} placeholder="Todos" />
              </label>
            </div>
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
                    <th className="text-right text-brand-700">Sugerido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.suggestions.map((s) => (
                    <tr key={s.variantId} className={s.suggestedQty > 0 ? '' : 'opacity-60'}>
                      <td className="py-2">
                        <div className="font-medium">{s.productName}</div>
                        <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                          {s.brand && <span>{s.brand}</span>}
                          {s.group && <span>· {s.group}</span>}
                          {s.subgroup && <span>· {s.subgroup}</span>}
                          <span>· {s.description}</span>
                        </div>
                      </td>
                      <td className="text-slate-500">{s.sku}</td>
                      <td className="text-right">{s.stockQty}</td>
                      <td className="text-right">{s.soldInWindow}</td>
                      <td className="text-right">{s.avgPerDay}</td>
                      <td className={`text-right text-base font-bold ${s.suggestedQty > 0 ? 'text-brand-700' : 'text-slate-400'}`}>
                        {s.suggestedQty > 0 ? `+${s.suggestedQty}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-slate-400">Nenhum produto encontrado para os filtros selecionados.</p>
          )}
        </>
      )}

      {tab === 'xml' && <XmlImport onSuccess={() => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['products'] }); }} />}
      {tab === 'manual' && <ManualPurchase />}
      {tab === 'lancadas' && <PurchasesList onView={setViewInvoiceId} />}

      {/* Modais via Portal — mesmo Padrão Ouro de Produtos/Caixa/Cadastros/Vendas */}
      {viewInvoiceId && (
        <ViewPurchaseModal
          id={viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
          onEdit={(invId) => { setViewInvoiceId(null); setEditInvoiceId(invId); }}
          onChanged={() => {
            setViewInvoiceId(null);
            qc.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}

      {editInvoiceId && (
        <EditPurchaseModal
          id={editInvoiceId}
          onClose={() => setEditInvoiceId(null)}
          onSaved={() => {
            setEditInvoiceId(null);
            qc.invalidateQueries({ queryKey: ['invoices'] });
            qc.invalidateQueries({ queryKey: ['invoice', editInvoiceId] });
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['financial'] });
          }}
        />
      )}
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
  const [hasSearchedSupplier, setHasSearchedSupplier] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PItem[]>([]);
  const [genPayable, setGenPayable] = useState(false);
  const [manualInstallments, setManualInstallments] = useState<PurchaseInstallment[]>([]);
  const [manualInstallmentsValid, setManualInstallmentsValid] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', supplierName],
    queryFn: () =>
      api.get<{ items: SupplierLite[] }>(`/api/persons?type=SUPPLIER&search=${encodeURIComponent(supplierName)}`),
    enabled: (supplierName.trim().length >= 2 || hasSearchedSupplier) && !supplierId,
  });
  const { onKeyDown: onSupplierKeyDown } = useSearchHandler(() => setHasSearchedSupplier(true));

  // Configuração global de precificação da loja — mesma fonte usada em
  // Configurações/Produtos/Etapa 2 do XmlImport.
  const { data: productFormSettings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const pricingMode = productFormSettings?.pricingMode ?? 'margin';

  const total = round2(items.reduce((a, it) => a + it.quantity * it.unitCost, 0));

  // Referências estáveis (useCallback) para o React.memo da linha do item
  // realmente evitar re-render das outras linhas a cada tecla.
  const handleItemChange = useCallback((variantId: string, patch: Partial<PItem>) => {
    setItems((prev) => prev.map((it) => (it.variantId === variantId ? { ...it, ...patch } : it)));
  }, []);
  const handleItemRemove = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((p) => p.variantId !== variantId));
  }, []);

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
        installments: genPayable ? manualInstallments : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['financial'] });
      setDone(true);
      setItems([]);
      setNotes('');
      setGenPayable(false);
      setManualInstallments([]);
      setManualInstallmentsValid(false);
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
    if (genPayable && !manualInstallmentsValid) {
      return setLocalError('As parcelas não fecham com o total da compra.');
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
          onKeyDown={onSupplierKeyDown}
          placeholder="Buscar ou digitar um novo fornecedor... (Enter para listar todos)"
        />
        {!supplierId && (supplierName.trim().length >= 2 || hasSearchedSupplier) && suppliers && suppliers.items.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
            {suppliers.items.map((s) => (
              <button
                key={s.id}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setSupplierId(s.id);
                  setSupplierName(s.name);
                  setHasSearchedSupplier(false);
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
                      // Produtos que já controlam lote/validade vêm marcados; os
                      // demais vêm desmarcados para o usuário decidir.
                      tracksLot: v.tracksLot,
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
            <ManualPurchaseItemRow
              key={it.variantId}
              item={it}
              pricingMode={pricingMode}
              onChange={handleItemChange}
              onRemove={handleItemRemove}
            />
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
        <PurchaseFinancialEngine
          totalAmount={total}
          onChange={(installments, valid) => {
            setManualInstallments(installments);
            setManualInstallmentsValid(valid);
          }}
        />
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
        <button
          className="btn-primary"
          disabled={save.isPending || (genPayable && !manualInstallmentsValid)}
          onClick={submit}
        >
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
  hasFinancial: boolean;
  supplier: { name: string };
  items: Array<{ id: string }>;
}

interface PurchaseFilterValues {
  doc: string;
  supplier: string;
  date: string;
  valueMin: string;
  valueMax: string;
  financial: 'ALL' | 'WITH_FINANCIAL' | 'WITHOUT_FINANCIAL';
}

const EMPTY_PURCHASE_FILTERS: PurchaseFilterValues = {
  doc: '',
  supplier: '',
  date: '',
  valueMin: '',
  valueMax: '',
  financial: 'ALL',
};

function PurchasesList({ onView }: { onView: (id: string) => void }) {
  const qc = useQueryClient();
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

  const [showFilters, setShowFilters] = useState(false);
  const [filterValues, setFilterValues] = useState<PurchaseFilterValues>(EMPTY_PURCHASE_FILTERS);

  function updateFilter<K extends keyof PurchaseFilterValues>(key: K, value: PurchaseFilterValues[K]) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }

  // Filtro avançado 100% client-side: nº do documento, fornecedor, data da
  // compra, faixa de valor total e status do financeiro — combinados (mesmo
  // padrão do filtro de Vendas em SalesPage.tsx).
  const filteredInvoices = useMemo(() => {
    const items = data?.items ?? [];
    const docTerm = filterValues.doc.trim().replace(/^#/, '');
    const supplierTerm = filterValues.supplier.trim().toLowerCase();
    const min = filterValues.valueMin.trim() ? parseFloat(filterValues.valueMin.replace(',', '.')) : null;
    const max = filterValues.valueMax.trim() ? parseFloat(filterValues.valueMax.replace(',', '.')) : null;

    return items.filter((inv) => {
      if (docTerm && !String(inv.documentNumber ?? '').includes(docTerm)) return false;
      if (supplierTerm && !inv.supplier.name.toLowerCase().includes(supplierTerm)) return false;
      if (filterValues.date) {
        const invDate = new Date(inv.issueDate).toLocaleDateString('en-CA');
        if (invDate !== filterValues.date) return false;
      }
      if (min !== null && !isNaN(min) && inv.totalAmount < min) return false;
      if (max !== null && !isNaN(max) && inv.totalAmount > max) return false;
      if (filterValues.financial === 'WITH_FINANCIAL' && !inv.hasFinancial) return false;
      if (filterValues.financial === 'WITHOUT_FINANCIAL' && inv.hasFinancial) return false;
      return true;
    });
  }, [data, filterValues]);

  const activeFilterCount = [
    filterValues.doc.trim() !== '',
    filterValues.supplier.trim() !== '',
    filterValues.date.trim() !== '',
    filterValues.valueMin.trim() !== '',
    filterValues.valueMax.trim() !== '',
    filterValues.financial !== 'ALL',
  ].filter(Boolean).length;

  // Paginação client-side (padrão Tray) — evita DOM overload em listas grandes.
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Filtro mudou → volta pra primeira página (o recorte antigo pode não existir mais).
  useEffect(() => {
    setCurrentPage(1);
  }, [filterValues]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));

  // Rede de segurança: se totalPages encolher (novo filtro/pageSize), evita página fantasma.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginatedInvoices = useMemo(
    () => filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredInvoices, currentPage, itemsPerPage],
  );

  if (isLoading) return <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          className={`relative ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowFilters((v) => !v)}
          title="Filtros avançados"
        >
          <Filter className="h-5 w-5" /> Filtros avançados
          {activeFilterCount > 0 && (
            <span className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-white shadow-soft">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="card animate-fade-in space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <label className="block">
              <span className="label">Nº do documento</span>
              <input
                className="input"
                value={filterValues.doc}
                onChange={(e) => updateFilter('doc', e.target.value)}
                placeholder="ex: #10"
              />
            </label>
            <label className="block">
              <span className="label">Fornecedor</span>
              <input
                className="input"
                value={filterValues.supplier}
                onChange={(e) => updateFilter('supplier', e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </label>
            <label className="block">
              <span className="label">Data da compra</span>
              <input
                type="date"
                className="input"
                value={filterValues.date}
                onChange={(e) => updateFilter('date', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label">Financeiro</span>
              <select
                className="input"
                value={filterValues.financial}
                onChange={(e) => updateFilter('financial', e.target.value as PurchaseFilterValues['financial'])}
              >
                <option value="ALL">Todos</option>
                <option value="WITH_FINANCIAL">Com financeiro</option>
                <option value="WITHOUT_FINANCIAL">Sem financeiro</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Valor mínimo (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                value={filterValues.valueMin}
                onChange={(e) => updateFilter('valueMin', sanitizeBr(e.target.value))}
                placeholder="0,00"
              />
            </label>
            <label className="block">
              <span className="label">Valor máximo (R$)</span>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                value={filterValues.valueMax}
                onChange={(e) => updateFilter('valueMax', sanitizeBr(e.target.value))}
                placeholder="Sem limite"
              />
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400">
              {filteredInvoices.length} de {data?.items.length ?? 0} compra(s)
            </span>
            <button className="btn-ghost text-sm" onClick={() => setFilterValues(EMPTY_PURCHASE_FILTERS)}>
              <RotateCcw className="h-4 w-4" /> Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="card">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="py-2">Doc.</th>
            <th>Fornecedor</th>
            <th>Data</th>
            <th className="text-center">Itens</th>
            <th className="text-right">Total</th>
            <th>Financeiro</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedInvoices.map((inv) => (
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
                {inv.hasFinancial ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Com financeiro
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    Sem financeiro
                  </span>
                )}
              </td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                    onClick={() => onView(inv.id)}
                    title="Visualizar / editar"
                  >
                    <Eye className="h-4 w-4" />
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
              <td colSpan={7} className="py-10 text-center text-slate-400">
                Nenhuma compra lançada.
              </td>
            </tr>
          )}
          {data && data.items.length > 0 && filteredInvoices.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-center text-slate-400">
                Nenhuma compra encontrada com os filtros aplicados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {filteredInvoices.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Linhas por página
            <select
              className="input h-9 w-auto py-1"
              value={String(itemsPerPage)}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>

          <div className="flex items-center gap-3 text-sm">
            <button
              className="btn-ghost h-9 px-3"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <span className="text-slate-500">
              Página <span className="font-semibold text-slate-700">{currentPage}</span> de{' '}
              <span className="font-semibold text-slate-700">{totalPages}</span>
            </span>
            <button
              className="btn-ghost h-9 px-3"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>

      <ScrollToTopButton />
    </div>
  );
}

// Botão flutuante "Voltar ao topo" — mesmo padrão validado em Cadastros/Vendas.
// Ejetado via createPortal(..., document.body): o `animate-fade-in` do
// Layout.tsx deixa um `transform` persistente no wrapper de rota, virando
// containing block e quebrando `position: fixed` em descendentes. A rolagem
// desta página é a do documento (Layout usa scroll natural), então o
// listener é no `window`.
function ScrollToTopButton() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return createPortal(
    <button
      className={`fixed right-4 bottom-24 md:bottom-8 md:right-8 z-50 grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white shadow-lg transition-all duration-300 hover:shadow-brand-lg hover:-translate-y-0.5 ${
        showScrollTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
      onClick={scrollToTop}
      title="Voltar ao topo"
    >
      <ArrowUp className="h-6 w-6" />
    </button>,
    document.body,
  );
}

interface InvoiceDetail {
  id: string;
  documentNumber: number | null;
  notes: string | null;
  issueDate: string;
  entryDate: string;
  totalAmount: number;
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitCost: number;
    variant: {
      description: string | null;
      sku: string;
      salePrice: number;
      costPrice: number;
      product: { name: string; tracksLotValidity: boolean };
    };
  }>;
  financialAccounts: Array<{ id: string; description: string; amount: number; dueDate: string; status: string }>;
}

// ---------------------------------------------------------------------------
// Visualização de uma compra lançada — Padrão Ouro (createPortal, header/
// body/footer). Casca idêntica à de Produtos/Caixa/Cadastros/Vendas.
// ---------------------------------------------------------------------------
function ViewPurchaseModal({
  id,
  onClose,
  onEdit,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [refazerMode, setRefazerMode] = useState(false);
  const [parcels, setParcels] = useState(1);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`),
  });

  const refreshInvoice = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    onChanged();
  };

  const deleteInvoice = useMutation({
    mutationFn: () => api.del(`/api/invoices/${id}`),
    onSuccess: () => { onChanged(); onClose(); },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  const deleteFinancial = useMutation({
    mutationFn: () => api.del(`/api/invoices/${id}/financial`),
    onSuccess: refreshInvoice,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir financeiro'),
  });

  const refazerFinancial = useMutation({
    mutationFn: () => {
      const total = Number(data!.totalAmount);
      const n = Math.max(1, parcels);
      const base = Math.floor((total / n) * 100) / 100;
      const installments = Array.from({ length: n }, (_, i) => {
        const amount = i === n - 1 ? round2(total - base * i) : base;
        const d = new Date(firstDue + 'T00:00:00');
        d.setDate(d.getDate() + i * intervalDays);
        return { dueDate: d.toISOString(), amount };
      });
      return api.post(`/api/invoices/${id}/financial`, { installments });
    },
    onSuccess: () => { refreshInvoice(); setRefazerMode(false); },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao refazer financeiro'),
  });

  const hasFinancial = (data?.financialAccounts.length ?? 0) > 0;
  const hasPaid = data?.financialAccounts.some((a) => a.status !== 'PENDING') ?? false;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-3xl flex flex-col max-h-[90dvh] !p-0 overflow-hidden">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50/50">
          <div>
            <h2 className="font-display text-lg font-bold">
              Compra {data?.documentNumber ? `#${data.documentNumber}` : ''}
            </h2>
            {data && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{data.supplier.name}</span>
                <span>· Emissão: {fmtDate(data.issueDate)}</span>
                {data.entryDate && data.entryDate !== data.issueDate && (
                  <span>· Entrada: {fmtDate(data.entryDate)}</span>
                )}
              </div>
            )}
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {isLoading || !data ? (
            <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.items.map((it) => (
                  <li key={it.id} className="flex justify-between py-1.5">
                    <span>{it.variant.product.name} — {it.variant.description ?? it.variant.sku}</span>
                    <span className="text-slate-500">{it.quantity} × {brl(it.unitCost)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                <span>Total</span>
                <span>{brl(data.totalAmount)}</span>
              </div>

              {/* Contas a pagar */}
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-sm">Contas a pagar</span>
                  {hasFinancial && !hasPaid && (
                    <button
                      className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                      disabled={deleteFinancial.isPending}
                      onClick={() => {
                        if (window.confirm('Excluir todos os títulos a pagar pendentes desta compra?'))
                          deleteFinancial.mutate();
                      }}
                    >
                      Excluir financeiro
                    </button>
                  )}
                  {!hasFinancial && !refazerMode && (
                    <button className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setRefazerMode(true)}>
                      Gerar financeiro
                    </button>
                  )}
                </div>

                {hasFinancial && !refazerMode && (
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {data.financialAccounts.map((a) => (
                      <li key={a.id} className="flex justify-between">
                        <span>{fmtDate(a.dueDate)} · {a.status}</span>
                        <span>{brl(a.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!hasFinancial && !refazerMode && (
                  <p className="text-xs text-slate-400">Nenhuma conta a pagar gerada.</p>
                )}

                {refazerMode && (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <label className="block">
                        <span className="label">Parcelas</span>
                        <input className="input h-9" type="number" min={1} value={parcels} onChange={(e) => setParcels(Number(e.target.value) || 1)} />
                      </label>
                      <label className="block">
                        <span className="label">1º vencimento</span>
                        <input className="input h-9" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
                      </label>
                      <label className="block">
                        <span className="label">Intervalo (dias)</span>
                        <input className="input h-9" type="number" value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value) || 30)} />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost flex-1 text-xs" onClick={() => setRefazerMode(false)}>Cancelar</button>
                      <button className="btn-primary flex-1 text-xs" disabled={refazerFinancial.isPending} onClick={() => refazerFinancial.mutate()}>
                        {refazerFinancial.isPending ? 'Gerando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {data.notes && <p className="text-sm text-slate-500">Obs.: {data.notes}</p>}
            </>
          )}
        </div>

        {data && (
          <footer className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
            <button className="btn-ghost" onClick={onClose}>Fechar</button>
            <button
              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
              disabled={deleteInvoice.isPending}
              onClick={() => {
                if (window.confirm('Excluir esta compra? O estoque será estornado.')) deleteInvoice.mutate();
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </button>
            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={hasFinancial}
              title={hasFinancial ? 'Exclua o financeiro antes de editar a compra' : 'Editar compra'}
              onClick={() => onEdit(id)}
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Edição completa de uma compra (Mini-PDV de Compras) — espelha EditSaleModal
// (SalesPage.tsx). O backend estorna o estoque antigo, recalcula o CMP dos
// novos itens e refaz o financeiro (PUT /api/invoices/:id com `items`).
// ---------------------------------------------------------------------------
function EditPurchaseModal({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [hasSearchedSupplier, setHasSearchedSupplier] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PItem[]>([]);
  const [genPayable, setGenPayable] = useState(false);
  const [editInstallments, setEditInstallments] = useState<PurchaseInstallment[]>([]);
  const [editInstallmentsValid, setEditInstallmentsValid] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`),
  });

  // Sincroniza o estado local do mini-PDV com os dados da compra assim que
  // chegam — guardado por items.length===0 para inicializar só uma vez
  // (mesmo padrão de EditSaleModal; cache compartilhado com ViewPurchaseModal,
  // que usa a mesma queryKey sem efeitos colaterais).
  useEffect(() => {
    if (!invoice || items.length > 0) return;
    setSupplierId(invoice.supplier.id);
    setSupplierName(invoice.supplier.name);
    setPurchaseDate(toDateInputValue(invoice.issueDate));
    setNotes(invoice.notes ?? '');
    setGenPayable(invoice.financialAccounts.length > 0);
    setItems(
      invoice.items.map((it) => ({
        variantId: it.variantId,
        label: `${it.variant.product.name} — ${it.variant.description ?? it.variant.sku}`,
        currentSalePrice: it.variant.salePrice,
        quantity: it.quantity,
        unitCost: it.unitCost,
        newSalePrice: '',
        tracksLot: it.variant.product.tracksLotValidity,
        batch: '',
        validity: '',
      })),
    );
  }, [invoice]);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', supplierName],
    queryFn: () =>
      api.get<{ items: SupplierLite[] }>(`/api/persons?type=SUPPLIER&search=${encodeURIComponent(supplierName)}`),
    enabled: (supplierName.trim().length >= 2 || hasSearchedSupplier) && !supplierId,
  });
  const { onKeyDown: onSupplierKeyDown } = useSearchHandler(() => setHasSearchedSupplier(true));

  const { data: productFormSettings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const pricingMode = productFormSettings?.pricingMode ?? 'margin';

  const total = round2(items.reduce((a, it) => a + it.quantity * it.unitCost, 0));

  const handleItemChange = useCallback((variantId: string, patch: Partial<PItem>) => {
    setItems((prev) => prev.map((it) => (it.variantId === variantId ? { ...it, ...patch } : it)));
  }, []);
  const handleItemRemove = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((p) => p.variantId !== variantId));
  }, []);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/invoices/${id}`, {
        supplierId: supplierId ?? undefined,
        purchaseDate,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
          unitCost: it.unitCost,
          newSalePrice: it.newSalePrice.trim() ? Number(it.newSalePrice) : undefined,
          tracksLotValidity: it.tracksLot,
          batch: it.batch || undefined,
          validity: it.validity || undefined,
        })),
        installments: genPayable ? editInstallments : undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  function submit() {
    setLocalError(null);
    if (!supplierId) return setLocalError('Selecione um fornecedor cadastrado.');
    if (items.length === 0) return setLocalError('Adicione ao menos um produto.');
    for (const it of items) {
      if (it.quantity <= 0 || it.unitCost < 0) return setLocalError('Quantidade/custo inválidos.');
      if (it.tracksLot && (!it.batch.trim() || !it.validity))
        return setLocalError(`Lote/validade obrigatórios em "${it.label}".`);
    }
    if (genPayable && !editInstallmentsValid) {
      return setLocalError('As parcelas não fecham com o total da compra.');
    }
    if (window.confirm('Salvar as alterações desta compra? O estoque e o custo médio serão recalculados.')) {
      save.mutate();
    }
  }

  const hasFinancial = (invoice?.financialAccounts.length ?? 0) > 0;

  // Guarda de segurança: bloqueia a edição se a compra já tiver financeiro
  // (contas a pagar) vinculado — o operador deve excluir o financeiro
  // manualmente na tela de visualização primeiro, para ter consciência do
  // impacto no caixa/contas a pagar (mesmo padrão do guard de
  // financialGenerated em EditSaleModal — bloqueia por existência do
  // financeiro, não só por parcela já baixada).
  if (invoice && hasFinancial) {
    return createPortal(
      <div className="modal-overlay">
        <div className="modal-sheet w-full sm:max-w-md flex flex-col overflow-hidden !p-0">
          <header className="shrink-0 p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-display text-lg font-bold">
              Editar compra {invoice.documentNumber ? `#${invoice.documentNumber}` : ''}
            </h2>
            <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ShieldAlert className="h-12 w-12 text-rose-500" />
              <p className="text-sm font-medium text-slate-700">
                Acesso Negado: esta compra possui financeiro (contas a pagar) vinculado. Exclua o
                financeiro na tela de visualização antes de editar.
              </p>
            </div>
          </div>
          <footer className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button className="btn-ghost" onClick={onClose}>Fechar</button>
          </footer>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-5xl flex flex-col h-[90dvh] !p-0 overflow-hidden">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50/50">
          <h2 className="font-display text-lg font-bold">
            Editar compra {invoice?.documentNumber ? `#${invoice.documentNumber}` : ''}
          </h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading || !invoice ? (
          <div className="flex-1 grid place-items-center text-slate-500">Carregando...</div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Carrinho */}
              <div className="space-y-4 lg:col-span-2">
                <div className="relative">
                  <span className="label">Fornecedor *</span>
                  <input
                    className="input"
                    value={supplierName}
                    onChange={(e) => { setSupplierName(e.target.value); setSupplierId(null); }}
                    onKeyDown={onSupplierKeyDown}
                    placeholder="Buscar fornecedor cadastrado... (Enter para listar todos)"
                  />
                  {!supplierId && (supplierName.trim().length >= 2 || hasSearchedSupplier) && suppliers && suppliers.items.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
                      {suppliers.items.map((s) => (
                        <button
                          key={s.id}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => { setSupplierId(s.id); setSupplierName(s.name); setHasSearchedSupplier(false); }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {supplierId && <span className="mt-1 inline-block text-xs text-emerald-600">✓ Fornecedor selecionado</span>}
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
                                tracksLot: v.tracksLot,
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
                      <ManualPurchaseItemRow
                        key={it.variantId}
                        item={it}
                        pricingMode={pricingMode}
                        onChange={handleItemChange}
                        onRemove={handleItemRemove}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo */}
              <div className="lg:sticky lg:top-0 lg:self-start">
                <div className="card space-y-3">
                  <div className="flex justify-between text-base font-bold">
                    <span>Total da compra</span>
                    <span>{brl(total)}</span>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 accent-brand-600"
                      checked={genPayable}
                      onChange={(e) => setGenPayable(e.target.checked)}
                    />
                    <span className="text-sm">
                      <span className="font-semibold text-slate-700">Gerar contas a pagar</span>
                      <span className="block text-xs text-slate-500">
                        Substitui as parcelas pendentes atuais. Se desmarcado, as parcelas
                        pendentes desta compra serão removidas e nenhuma nova será criada.
                      </span>
                    </span>
                  </label>

                  {genPayable && (
                    <PurchaseFinancialEngine
                      totalAmount={total}
                      onChange={(installments, valid) => {
                        setEditInstallments(installments);
                        setEditInstallmentsValid(valid);
                      }}
                    />
                  )}

                  {(localError || save.error instanceof ApiError) && (
                    <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {localError ?? (save.error as ApiError).message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {invoice && (
          <footer className="shrink-0 flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button
              className="btn-primary"
              disabled={save.isPending || (genPayable && !editInstallmentsValid)}
              onClick={submit}
            >
              {save.isPending ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
interface VariantHit {
  id: string;
  label: string;
  salePrice: number;
  costPrice: number;
  tracksLot: boolean;
}

/** Abre um modal completo com busca + filtros (marca/grupo) para selecionar produto. */
function ProductSearch({ onPick }: { onPick: (v: VariantHit) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-ghost w-full justify-start gap-2 text-slate-500"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" /> Selecionar produto do catálogo...
      </button>
      {open && (
        <ProductPickerModal
          onPick={(v) => { onPick(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ProductPickerModal({ onPick, onClose }: { onPick: (v: VariantHit) => void; onClose: () => void }) {
  // Busca pesada só dispara no Enter — `searchInput` guarda o texto digitado,
  // `search` é o valor efetivamente aplicado na query.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { onKeyDown: onSearchKeyDown } = useSearchHandler(setSearch);
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['picker-products', search, brand, group],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: '80' });
      if (search.trim()) qs.set('search', search.trim());
      if (brand.trim()) qs.set('brand', brand.trim());
      if (group.trim()) qs.set('group', group.trim());
      return api.get<{
        items: Array<{
          id: string;
          name: string;
          brand: string;
          group: string;
          tracksLotValidity: boolean;
          variants: Array<{ id: string; description: string; sku: string; salePrice: number; costPrice: number; stockQty: number }>;
        }>;
      }>(`/api/products?${qs.toString()}`);
    },
  });

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-3xl flex flex-col h-auto max-h-[90dvh] !p-0 overflow-hidden">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-display text-lg font-bold">Selecionar Produto</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50 space-y-4">
          {/* Busca + filtros */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Buscar por nome, marca ou SKU... (Enter para buscar)"
                  autoFocus
                />
              </div>
              <button
                className={showFilters ? 'btn-primary px-3' : 'btn-ghost px-3'}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 gap-2 animate-fade-in">
                <label className="block">
                  <span className="label">Marca</span>
                  <input className="input h-9 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Todas" />
                </label>
                <label className="block">
                  <span className="label">Grupo</span>
                  <input className="input h-9 text-sm" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Todos" />
                </label>
              </div>
            )}
          </div>

          {/* Grid de produtos */}
          {isLoading ? (
            <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items.flatMap((p) =>
                p.variants.map((v) => (
                  <button
                    key={v.id}
                    className="card-hover flex flex-col items-start gap-0.5 p-3 text-left text-sm"
                    onClick={() =>
                      onPick({
                        id: v.id,
                        label: `${p.name} — ${v.description} (${v.sku})`,
                        salePrice: v.salePrice,
                        costPrice: v.costPrice,
                        tracksLot: p.tracksLotValidity,
                      })
                    }
                  >
                    <div className="flex w-full items-start justify-between gap-1">
                      <span className="font-semibold leading-snug">{p.name}</span>
                      {p.brand && <span className="badge-brand shrink-0 text-[10px]">{p.brand}</span>}
                    </div>
                    <span className="text-xs text-slate-500">{v.description} · {v.sku}</span>
                    <div className="mt-1 flex w-full items-center justify-between">
                      <span className="font-bold text-brand-700">{brl(v.costPrice)}</span>
                      <span className="text-xs text-slate-400">est. {v.stockQty}</span>
                    </div>
                  </button>
                )),
              )}
              {data?.items.length === 0 && (
                <p className="col-span-full py-10 text-center text-slate-400">Nenhum produto encontrado.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Linha de um item da compra manual — extraída em componente próprio
 * (memoizado) para isolar os estados locais de digitação (rawCost/rawPrice/
 * rawPct) e evitar que a lista inteira re-renderize a cada tecla. `onChange`/
 * `onRemove` são referências estáveis (useCallback no pai) recebendo
 * `variantId` como argumento — só assim o React.memo realmente evita
 * re-render das outras linhas quando uma muda.
 */
const ManualPurchaseItemRow = memo(function ManualPurchaseItemRow({
  item,
  pricingMode,
  onChange,
  onRemove,
}: {
  item: PItem;
  pricingMode: 'margin' | 'markup';
  onChange: (variantId: string, patch: Partial<PItem>) => void;
  onRemove: (variantId: string) => void;
}) {
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');

  const [rawCost, setRawCost] = useState(() => toRaw(item.unitCost));
  const skipCostSync = useRef(false);
  useEffect(() => {
    if (skipCostSync.current) { skipCostSync.current = false; return; }
    setRawCost(toRaw(item.unitCost));
  }, [item.unitCost]);

  const [rawPrice, setRawPrice] = useState(() => (item.newSalePrice ? item.newSalePrice.replace('.', ',') : ''));
  const skipPriceSync = useRef(false);
  useEffect(() => {
    if (skipPriceSync.current) { skipPriceSync.current = false; return; }
    setRawPrice(item.newSalePrice ? item.newSalePrice.replace('.', ',') : '');
  }, [item.newSalePrice]);

  // % é apoio de UX puro (nunca vai ao backend sozinho — só via newSalePrice
  // já calculado); inicializa a partir de um newSalePrice pré-existente, se houver.
  const [rawPct, setRawPct] = useState(() => {
    if (!item.newSalePrice) return '';
    const price = parseFloat(item.newSalePrice);
    const pct = pricingMode === 'margin' ? marginFromPrice(item.unitCost, price) : markupFromPrice(item.unitCost, price);
    return pct ? toRaw(pct) : '';
  });
  const skipPctSync = useRef(false);

  function commitCost(cleaned: string) {
    setRawCost(cleaned);
    skipCostSync.current = true;
    const newCost = parseFloat(cleaned.replace(',', '.')) || 0;
    // Se já existe um % ativo nesta linha, preserva-o e recalcula o preço
    // a partir do novo custo (mesma regra do formulário de Produtos).
    const pct = parseFloat(rawPct.replace(',', '.'));
    if (rawPct.trim() && !isNaN(pct)) {
      const newPrice = pricingMode === 'margin' ? priceFromMargin(newCost, pct) : priceFromMarkup(newCost, pct);
      skipPriceSync.current = true;
      setRawPrice(toRaw(newPrice));
      onChange(item.variantId, { unitCost: newCost, newSalePrice: String(newPrice) });
    } else {
      onChange(item.variantId, { unitCost: newCost });
    }
  }

  function commitPrice(cleaned: string) {
    setRawPrice(cleaned);
    skipPriceSync.current = true;
    if (!cleaned.trim()) {
      onChange(item.variantId, { newSalePrice: '' });
      skipPctSync.current = true;
      setRawPct('');
      return;
    }
    const price = parseFloat(cleaned.replace(',', '.')) || 0;
    onChange(item.variantId, { newSalePrice: String(price) });
    const pct = pricingMode === 'margin' ? marginFromPrice(item.unitCost, price) || 0 : markupFromPrice(item.unitCost, price) || 0;
    skipPctSync.current = true;
    setRawPct(pct !== 0 ? toRaw(pct) : '');
  }

  function commitPct(cleaned: string) {
    if (!cleaned.trim()) {
      setRawPct('');
      skipPriceSync.current = true;
      setRawPrice('');
      onChange(item.variantId, { newSalePrice: '' });
      return;
    }
    let pct = parseFloat(cleaned.replace(',', '.')) || 0;
    if (pricingMode === 'margin' && pct > 99.99) {
      pct = 99.99;
      cleaned = '99,99';
    }
    setRawPct(cleaned);
    skipPctSync.current = true;
    const price = pricingMode === 'margin' ? priceFromMargin(item.unitCost, pct) : priceFromMarkup(item.unitCost, pct);
    skipPriceSync.current = true;
    setRawPrice(toRaw(price));
    onChange(item.variantId, { newSalePrice: String(price) });
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{item.label}</span>
        <button className="text-slate-300 hover:text-rose-500" onClick={() => onRemove(item.variantId)}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        <Num
          label="Qtd"
          value={item.quantity}
          onChange={(v) => onChange(item.variantId, { quantity: v })}
        />
        <label className="block">
          <span className="label">Custo (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            value={rawCost}
            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
            onChange={(e) => commitCost(sanitizeBr(e.target.value))}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <label className="block">
          <span className="label">Novo preço venda</span>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            value={rawPrice}
            placeholder={`atual ${brl(item.currentSalePrice)}`}
            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
            onChange={(e) => commitPrice(sanitizeBr(e.target.value))}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <label className="block">
          <span className="label">{pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}</span>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            value={rawPct}
            placeholder="0,00"
            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
            onChange={(e) => commitPct(sanitizeBr(e.target.value))}
            onFocus={(e) => e.target.select()}
          />
        </label>
        <label className="flex items-end gap-2 pb-1 text-xs">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-600"
            checked={item.tracksLot}
            onChange={(e) => onChange(item.variantId, { tracksLot: e.target.checked })}
          />
          Lote/validade
        </label>
      </div>
      {item.tracksLot && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label">Lote *</span>
            <input
              className="input"
              value={item.batch}
              onChange={(e) => onChange(item.variantId, { batch: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Validade *</span>
            <input
              className="input"
              type="date"
              value={item.validity}
              onChange={(e) => onChange(item.variantId, { validity: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
});

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
