import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, FileText, Search, X, Check, ChevronRight, Plus, Trash2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface ParsedItem {
  supplierItemCode: string;
  supplierBarcode: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  cfop: string;
  matchedVariantId: string | null;
}
interface ParsedNfe {
  accessKey: string;
  issueDate: string;
  supplier: { document: string; name: string; existingId: string | null };
  totalAmount: number;
  items: ParsedItem[];
  duplicates: Array<{ number: string; dueDate: string; amount: number }>;
  alreadyImported: boolean;
}
interface VariantDetail {
  id: string;
  sku: string;
  description: string | null;
  costPrice: number;
  salePrice: number;
  productName: string;
  brand?: string | null;
  group?: string | null;
}

type Step = 'upload' | 'mapping' | 'prices' | 'financial';
type FinancialMode = 'xml' | 'custom' | 'none';

// ---------------------------------------------------------------------------

export function XmlImport({ onSuccess }: { onSuccess?: () => void }) {
  // estado global
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedNfe | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // passo 1: De/Para
  const [mapping, setMapping] = useState<Record<number, VariantDetail>>({});
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  // passo 2: revisão de preços — keyed by item index
  const [newPrices, setNewPrices] = useState<Record<number, string>>({});

  // passo 3: financeiro
  const [financialMode, setFinancialMode] = useState<FinancialMode>('xml');
  const [customInst, setCustomInst] = useState<{ dueDate: string; amount: string }[]>([
    { dueDate: '', amount: '' },
  ]);

  // ----- Upload -----
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const data = await api.post<ParsedNfe>('/api/invoices/parse', { xml: text });
      setParsed(data);
      const init: Record<number, VariantDetail> = {};
      data.items.forEach((it, i) => {
        if (it.matchedVariantId) {
          init[i] = { id: it.matchedVariantId, sku: '', description: it.description, costPrice: 0, salePrice: 0, productName: it.description };
        }
      });
      setMapping(init);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao processar XML');
    } finally {
      setBusy(false);
    }
  }

  // ----- Confirmação final -----
  async function handleConfirm() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      let supplierId = parsed.supplier.existingId;
      if (!supplierId) {
        const created = await api.post<{ id: string }>('/api/persons', {
          type: 'SUPPLIER',
          name: parsed.supplier.name,
          document: parsed.supplier.document,
        });
        supplierId = created.id;
      }

      // Monta parcelas
      let customInstallments: { dueDate: string; amount: number }[] | undefined;
      if (financialMode === 'custom') {
        customInstallments = customInst.map((i) => ({
          dueDate: i.dueDate,
          amount: parseFloat(i.amount.replace(',', '.')),
        }));
      }

      await api.post('/api/invoices/confirm', {
        supplierId,
        accessKey: parsed.accessKey,
        issueDate: parsed.issueDate,
        totalAmount: parsed.totalAmount,
        items: parsed.items.map((it, i) => ({
          variantId: mapping[i]!.id,
          quantity: it.quantity,
          unitCost: it.unitCost,
          cfop: it.cfop,
          supplierItemCode: it.supplierItemCode,
          supplierBarcode: it.supplierBarcode,
          saveMapping: true,
          newSalePrice: newPrices[i] ? parseFloat(newPrices[i].replace(',', '.')) : undefined,
        })),
        duplicates: financialMode === 'xml' ? parsed.duplicates : [],
        customInstallments: financialMode === 'custom' ? customInstallments : undefined,
      });

      setSuccess('Entrada confirmada! Estoque e Contas a Pagar atualizados.');
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao confirmar');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setParsed(null);
    setFileName(null);
    setStep('upload');
    setMapping({});
    setNewPrices({});
    setFinancialMode('xml');
    setCustomInst([{ dueDate: '', amount: '' }]);
  }

  const allMapped = parsed?.items.every((_, i) => mapping[i]?.id);

  // Inicializa modo financeiro ao entrar na etapa
  function goToFinancial() {
    if (parsed?.duplicates.length) {
      setFinancialMode('xml');
    } else {
      setFinancialMode('none');
    }
    setStep('financial');
  }

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Indicador de etapas */}
      {step !== 'upload' && parsed && (
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
          <StepBadge n={1} label="De/Para" active={step === 'mapping'} done={step !== 'mapping'} />
          <ChevronRight className="h-3 w-3 shrink-0" />
          <StepBadge n={2} label="Preços" active={step === 'prices'} done={step === 'financial'} />
          <ChevronRight className="h-3 w-3 shrink-0" />
          <StepBadge n={3} label="Financeiro" active={step === 'financial'} done={false} />
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ETAPA: upload */}
      {step === 'upload' && (
        <div className="card">
          <label className="label">Arquivo XML da nota de compra (NFe)</label>
          <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <UploadCloud className="h-10 w-10 text-brand-400" />
            <span className="font-semibold text-slate-700">
              {busy ? 'Processando...' : 'Clique para selecionar o arquivo .xml'}
            </span>
            <span className="text-xs text-slate-400">
              {fileName ? (
                <span className="inline-flex items-center gap-1 text-brand-600">
                  <FileText className="h-3.5 w-3.5" /> {fileName}
                </span>
              ) : (
                'Selecione o XML emitido pelo fornecedor'
              )}
            </span>
            <input type="file" accept=".xml,text/xml,application/xml" className="hidden" disabled={busy} onChange={handleFile} />
          </label>
        </div>
      )}

      {/* ETAPA 1: De/Para */}
      {step === 'mapping' && parsed && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="text-xs text-slate-400">Fornecedor</div>
                <div className="font-semibold">{parsed.supplier.name || '—'}</div>
                <div className="text-xs text-slate-500">{parsed.supplier.document}</div>
                {!parsed.supplier.existingId && (
                  <span className="text-xs text-amber-600">Será cadastrado automaticamente</span>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Total da nota</div>
                <div className="text-lg font-bold">{brl(parsed.totalAmount)}</div>
                <div className="text-xs text-slate-400">Emissão: {fmtDate(parsed.issueDate)}</div>
              </div>
            </div>
            {parsed.alreadyImported && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                ⚠️ Esta nota já foi importada anteriormente.
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-semibold">Passo 1 — Associe cada item do XML ao produto cadastrado</div>
            {parsed.items.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap justify-between gap-1 text-sm">
                  <span className="font-medium">{it.description}</span>
                  <span className="text-slate-500">
                    {it.quantity} × {brl(it.unitCost)} · CFOP {it.cfop}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Cód. forn.: {it.supplierItemCode} · EAN: {it.supplierBarcode ?? '—'}
                </div>
                {mapping[i] ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      {mapping[i].productName}
                      {mapping[i].description ? ` — ${mapping[i].description}` : ''}
                      <span className="text-emerald-500 text-xs">({mapping[i].sku || 'mapeado'})</span>
                    </span>
                    <button className="text-xs underline shrink-0" onClick={() => { setMapping((m) => { const n = { ...m }; delete n[i]; return n; }); }}>
                      trocar
                    </button>
                  </div>
                ) : (
                  <button
                    className="mt-2 w-full rounded-lg border border-dashed border-brand-300 bg-brand-50/30 px-3 py-2 text-sm text-brand-700 hover:bg-brand-50 flex items-center justify-center gap-2"
                    onClick={() => { setError(null); setPickerIdx(i); }}
                  >
                    <Search className="h-4 w-4" /> Selecionar produto do catálogo
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={reset}>Cancelar</button>
            <button
              className="btn-primary"
              disabled={!allMapped || parsed.alreadyImported}
              onClick={() => setStep('prices')}
            >
              Próximo: Revisão de preços <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 2: Revisão de preços */}
      {step === 'prices' && parsed && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="text-sm font-semibold">Passo 2 — Revise os preços de venda</div>
            <p className="text-xs text-slate-500">
              Para cada item, veja o custo anterior e o da nota. Se quiser, informe um novo preço de venda. Deixe em branco para manter o atual.
            </p>
            {parsed.items.map((it, i) => {
              const v = mapping[i];
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap justify-between gap-1 text-sm">
                    <span className="font-medium">{v?.productName || it.description}</span>
                    {v?.description && <span className="text-slate-500 text-xs">{v.description}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <InfoCell label="Custo anterior" value={v?.costPrice != null && v.costPrice > 0 ? brl(v.costPrice) : '—'} />
                    <InfoCell label="Custo na nota" value={brl(it.unitCost)} highlight />
                    <InfoCell label="P. venda atual" value={v?.salePrice != null && v.salePrice > 0 ? brl(v.salePrice) : '—'} />
                    <div>
                      <div className="text-slate-400 mb-0.5">Novo p. venda</div>
                      <input
                        className="input h-8 text-sm w-full"
                        value={newPrices[i] ?? ''}
                        onChange={(e) => setNewPrices((p) => ({ ...p, [i]: e.target.value }))}
                        placeholder={v?.salePrice != null && v.salePrice > 0 ? brl(v.salePrice) : 'Manter atual'}
                        inputMode="decimal"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep('mapping')}>← Voltar</button>
            <button className="btn-primary" onClick={goToFinancial}>
              Próximo: Contas a pagar <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 3: Financeiro */}
      {step === 'financial' && parsed && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="text-sm font-semibold">Passo 3 — Como gerar as Contas a Pagar?</div>

            {/* opção: duplicatas do XML */}
            {parsed.duplicates.length > 0 && (
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${financialMode === 'xml' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
                <input type="radio" className="mt-0.5 accent-brand-600" checked={financialMode === 'xml'} onChange={() => setFinancialMode('xml')} />
                <div>
                  <div className="font-medium text-sm">Usar duplicatas do XML</div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    {parsed.duplicates.map((d, i) => (
                      <div key={i}>Dup. {d.number} — {fmtDate(d.dueDate)} — {brl(d.amount)}</div>
                    ))}
                  </div>
                </div>
              </label>
            )}

            {/* opção: parcelamento personalizado */}
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${financialMode === 'custom' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
              <input type="radio" className="mt-0.5 accent-brand-600" checked={financialMode === 'custom'} onChange={() => setFinancialMode('custom')} />
              <div className="flex-1">
                <div className="font-medium text-sm">Parcelamento personalizado</div>
                <div className="text-xs text-slate-500">Informe as datas e valores das parcelas.</div>
                {financialMode === 'custom' && (
                  <div className="mt-2 space-y-2">
                    {customInst.map((inst, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="date"
                          className="input h-9 flex-1 text-sm"
                          value={inst.dueDate}
                          onChange={(e) => setCustomInst((ci) => ci.map((x, j) => j === idx ? { ...x, dueDate: e.target.value } : x))}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input h-9 w-28 text-sm"
                          placeholder="R$ 0,00"
                          value={inst.amount}
                          onChange={(e) => setCustomInst((ci) => ci.map((x, j) => j === idx ? { ...x, amount: e.target.value } : x))}
                        />
                        {customInst.length > 1 && (
                          <button className="text-slate-400 hover:text-rose-600" onClick={() => setCustomInst((ci) => ci.filter((_, j) => j !== idx))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="btn-ghost text-sm" onClick={() => setCustomInst((ci) => [...ci, { dueDate: '', amount: '' }])}>
                      <Plus className="h-4 w-4" /> Adicionar parcela
                    </button>
                    <div className="text-xs text-slate-400">
                      Total informado: {brl(customInst.reduce((s, i) => s + (parseFloat(i.amount.replace(',', '.')) || 0), 0))}
                      {' '}/ Total da nota: {brl(parsed.totalAmount)}
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* opção: sem financeiro */}
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${financialMode === 'none' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
              <input type="radio" className="mt-0.5 accent-brand-600" checked={financialMode === 'none'} onChange={() => setFinancialMode('none')} />
              <div>
                <div className="font-medium text-sm">Não gerar contas a pagar</div>
                <div className="text-xs text-slate-500">Apenas dá entrada no estoque, sem movimentação financeira.</div>
              </div>
            </label>
          </div>

          <div className="flex justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep('prices')}>← Voltar</button>
            <button
              className="btn-primary"
              disabled={busy || parsed.alreadyImported}
              onClick={handleConfirm}
            >
              {busy ? 'Confirmando...' : 'Confirmar entrada'}
            </button>
          </div>
        </div>
      )}

      {/* Modal do picker de produto (renderizado fora do card) */}
      {pickerIdx !== null && (
        <ProductPickerModal
          onClose={() => setPickerIdx(null)}
          onSelect={(v) => {
            setMapping((m) => ({ ...m, [pickerIdx!]: v }));
            setPickerIdx(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${active ? 'bg-brand-gradient text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
      {done ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">{n}</span>}
      {label}
    </span>
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-slate-400 mb-0.5">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-brand-700' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductPickerModal — catálogo completo com filtros
// ---------------------------------------------------------------------------
interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  group: string | null;
  variants: Array<{
    id: string;
    sku: string;
    description: string | null;
    stockQty: number;
    costPrice: number;
    salePrice: number;
  }>;
}

function ProductPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (v: VariantDetail) => void;
}) {
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['product-picker-all', search, brand, group],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (brand.trim()) params.set('brand', brand.trim());
      if (group.trim()) params.set('group', group.trim());
      params.set('pageSize', '200');
      return api.get<{ items: ProductRow[] }>(`/api/products?${params}`);
    },
    staleTime: 30_000,
  });

  const products = data?.items ?? [];

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-xl">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Selecionar produto</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="relative sm:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input h-10 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU, código de barras..."
              autoFocus
            />
          </label>
          <input className="input h-9 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Filtrar marca" />
          <input className="input h-9 text-sm" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Filtrar grupo" />
        </div>

        {/* Lista */}
        <div className="max-h-[55dvh] overflow-y-auto space-y-1 pr-1">
          {isLoading && <div className="py-8 text-center text-slate-400">Carregando produtos...</div>}
          {!isLoading && products.length === 0 && (
            <div className="py-8 text-center text-slate-400">Nenhum produto encontrado.</div>
          )}
          {products.map((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50 transition"
                onClick={() =>
                  onSelect({
                    id: v.id,
                    sku: v.sku,
                    description: v.description,
                    costPrice: v.costPrice,
                    salePrice: v.salePrice,
                    productName: p.name,
                    brand: p.brand,
                    group: p.group,
                  })
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    {v.description && <div className="text-xs text-slate-500 truncate">{v.description}</div>}
                    <div className="text-xs text-slate-400 mt-0.5">
                      SKU: {v.sku}
                      {p.brand && ` · ${p.brand}`}
                      {p.group && ` · ${p.group}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-slate-500">
                    <div>Estoque: {v.stockQty}</div>
                    <div>Custo: {v.costPrice > 0 ? brl(v.costPrice) : '—'}</div>
                    <div>Venda: {v.salePrice > 0 ? brl(v.salePrice) : '—'}</div>
                  </div>
                </div>
              </button>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
