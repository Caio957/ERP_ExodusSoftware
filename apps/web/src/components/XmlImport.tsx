import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  Search,
  X,
  Check,
  ChevronRight,
  Trash2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  type ProductFormSettings,
  type PaymentType,
  DEFAULT_PAYMENT_TYPES,
  priceFromMargin,
  priceFromMarkup,
  marginFromPrice,
  markupFromPrice,
} from '@exodus/shared';
import { api, ApiError } from '../lib/api';
import { useSearchHandler } from '../hooks/useSearchHandler';
import { maskCpfCnpj } from '../lib/masks';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Padrão BR de vírgula decimal (mesmo helper usado em PDV/Vendas/Produtos).
function sanitizeBr(s: string): string {
  let v = s.replace(/\./g, ',');
  v = v.replace(/[^\d,]/g, '');
  v = v.replace(/^,/, '');
  const parts = v.split(',');
  if (parts.length > 1) v = parts[0] + ',' + parts.slice(1).join('');
  return v.replace(/^0+(?=\d)/, '');
}

// NFe 3.10 traz `dEmi`/`dVenc` como data pura (YYYY-MM-DD) — precisa do
// "T00:00:00" para não sofrer shift de fuso. NFe 4.00 traz `dhEmi` como
// datetime ISO já com offset (ex: 2026-07-09T15:48:32-03:00) — concatenar
// "T00:00:00" nesse formato gera uma string inválida ("Invalid Date").
function fmtDate(s: string): string {
  if (!s) return '—';
  const date = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
  return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

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
  const [dragOver, setDragOver] = useState(false);
  // Data de entrada/digitação — quando o operador está dando entrada, distinta
  // da emissão da NFe (parsed.issueDate). Padrão: hoje.
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sem isso, soltar o arquivo fora da zona de drop faz o navegador NAVEGAR
  // para o XML (abre o arquivo numa aba, derrubando o app). Bloqueia o
  // comportamento padrão em toda a janela enquanto a tela está montada.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  // Configuração global de precificação da loja (Margem sobre venda ou
  // Markup sobre custo) — mesma fonte usada em Configurações/Produtos.
  const { data: productFormSettings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const pricingMode = productFormSettings?.pricingMode ?? 'margin';

  // passo 1: De/Para
  const [mapping, setMapping] = useState<Record<number, VariantDetail>>({});
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  // passo 2: revisão de preços — keyed by item index. `newPct` é só apoio de
  // UX (nunca vai ao backend); a base de cálculo é sempre o custo da nota
  // (it.unitCost), não o custo anterior da variante.
  const [newPrices, setNewPrices] = useState<Record<number, number>>({});
  const [newPct, setNewPct] = useState<Record<number, number>>({});

  function applyNewPrice(i: number, xmlCost: number, price: number) {
    setNewPrices((p) => ({ ...p, [i]: price }));
    const pct =
      pricingMode === 'margin' ? marginFromPrice(xmlCost, price) || 0 : markupFromPrice(xmlCost, price) || 0;
    setNewPct((p) => ({ ...p, [i]: pct }));
  }

  function applyNewPct(i: number, xmlCost: number, pct: number) {
    const safePct = pricingMode === 'margin' ? Math.min(pct, 99.99) : pct;
    setNewPct((p) => ({ ...p, [i]: safePct }));
    const price = pricingMode === 'margin' ? priceFromMargin(xmlCost, safePct) : priceFromMarkup(xmlCost, safePct);
    setNewPrices((p) => ({ ...p, [i]: price }));
  }

  // Tipos de recebimento configuráveis — mesma fonte usada no PDV.
  const { data: ptData } = useQuery({
    queryKey: ['payment-types'],
    queryFn: () => api.get<{ types: PaymentType[] }>('/api/settings/payment-types'),
  });
  const paymentTypes = (ptData?.types ?? DEFAULT_PAYMENT_TYPES).filter((t) => t.active);

  // passo 3: financeiro — "espelho" do split de pagamento do PDV (formas +
  // A_PRAZO com parcelamento), sem o conceito de cliente (o fornecedor já
  // está resolvido nesta etapa).
  const [financialMode, setFinancialMode] = useState<FinancialMode>('xml');
  const [lines, setLines] = useState<{ method: string; amount: number }[]>([]);
  const [parcels, setParcels] = useState(2);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [conditionStr, setConditionStr] = useState('30');
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

  // ----- Upload -----
  // Núcleo compartilhado entre o clique (input file) e o arrastar-e-soltar.
  async function processFile(file: File) {
    const isXml = /\.xml$/i.test(file.name) || file.type === 'text/xml' || file.type === 'application/xml';
    if (!isXml) {
      setError(`"${file.name}" não é um XML — selecione o arquivo .xml da NFe emitida pelo fornecedor.`);
      return;
    }
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processFile(file);
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

      // Monta parcelas: linhas à vista viram uma parcela única vencendo hoje;
      // a linha A_PRAZO (se houver) já vem parcelada via resolvedInstallments.
      let customInstallments: { dueDate: string; amount: number }[] | undefined;
      if (financialMode === 'custom') {
        const todayStr = new Date().toISOString().slice(0, 10);
        customInstallments = [
          ...lines
            .filter((l) => l.method !== 'A_PRAZO' && l.amount > 0)
            .map((l) => ({ dueDate: todayStr, amount: l.amount })),
          ...(resolvedInstallments ?? []),
        ];
      }

      await api.post('/api/invoices/confirm', {
        supplierId,
        accessKey: parsed.accessKey,
        issueDate: parsed.issueDate,
        entryDate,
        totalAmount: parsed.totalAmount,
        items: parsed.items.map((it, i) => {
          const newPrice = newPrices[i];
          return {
            variantId: mapping[i]!.id,
            quantity: it.quantity,
            unitCost: it.unitCost,
            cfop: it.cfop,
            supplierItemCode: it.supplierItemCode,
            supplierBarcode: it.supplierBarcode,
            saveMapping: true,
            newSalePrice: newPrice != null && newPrice > 0 ? newPrice : undefined,
          };
        }),
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
    setNewPct({});
    setFinancialMode('xml');
    setLines([]);
    setParcels(2);
    setFirstDue(new Date().toISOString().slice(0, 10));
    setConditionStr('30');
    setCustomDates({});
    setEntryDate(new Date().toISOString().split('T')[0]);
  }

  const allMapped = parsed?.items.every((_, i) => mapping[i]?.id);

  // Inicializa modo financeiro ao entrar na etapa
  function goToFinancial() {
    if (parsed?.duplicates.length) {
      setFinancialMode('xml');
    } else {
      setFinancialMode('none');
    }
    if (parsed) {
      setLines([{ method: paymentTypes[0]?.code ?? 'CASH', amount: round2(parsed.totalAmount) }]);
    }
    setStep('financial');
  }

  // ----- Split de pagamento da compra — espelho do PaymentModal do PDV,
  // sem o conceito de cliente (o fornecedor já está resolvido nesta etapa). -----
  const financialTotal = parsed?.totalAmount ?? 0;
  const paidLines = round2(lines.reduce((a, l) => a + (l.amount || 0), 0));
  const remainingLines = round2(financialTotal - paidLines);
  const aPrazoTotal = round2(
    lines.filter((l) => l.method === 'A_PRAZO').reduce((a, l) => a + (l.amount || 0), 0),
  );

  // Valida se o 1º vencimento é uma data real antes de usá-la.
  const firstDueDate = firstDue.trim() ? new Date(firstDue + 'T00:00:00') : null;
  const firstDueValid = !!firstDueDate && !isNaN(firstDueDate.getTime());

  // Formata YYYY-MM-DD usando data LOCAL (evita shift de fuso horário UTC-3).
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function genInstallments() {
    if (!firstDueValid || !firstDueDate) return [];
    const n = Math.max(1, Math.floor(parcels));
    const base = Math.floor((aPrazoTotal / n) * 100) / 100;
    const parts: { dueDate: string; amount: number }[] = [];
    let acc = 0;
    // Parser: "30" → [30]; "30/60/90" → [30,60,90]; "30-60" → [30,60]
    const intervals = conditionStr
      .split(/[\/\-,. ]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);
    const multiInterval = intervals.length > 1;
    const fallbackInterval = intervals[intervals.length - 1] ?? 30;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(aPrazoTotal - acc) : base;
      acc = round2(acc + amount);
      let dueDate: string;
      if (multiInterval) {
        if (i < intervals.length) {
          const interval = intervals[i] ?? fallbackInterval;
          const d = new Date(firstDueDate);
          d.setDate(d.getDate() + interval);
          dueDate = localDateStr(d);
        } else {
          const prev = parts[i - 1];
          const prevDate = prev ? new Date(prev.dueDate + 'T00:00:00') : new Date(firstDueDate);
          prevDate.setDate(prevDate.getDate() + fallbackInterval);
          dueDate = localDateStr(prevDate);
        }
      } else {
        const interval = intervals[0] ?? 30;
        const d = new Date(firstDueDate);
        d.setDate(d.getDate() + i * interval);
        dueDate = localDateStr(d);
      }
      parts.push({ dueDate, amount });
    }
    return parts;
  }

  function isWeekend(dateStr: string) {
    const day = new Date(dateStr + 'T00:00:00').getDay();
    return day === 0 || day === 6;
  }

  const aPrazoInstallments = aPrazoTotal > 0 && firstDueValid ? genInstallments() : undefined;
  // Aplica overrides manuais de data antes de enviar ao backend e exibir ao usuário.
  const resolvedInstallments = aPrazoInstallments?.map((p, i) => ({
    ...p,
    dueDate: customDates[i] ?? p.dueDate,
  }));
  const weekendParcelas = resolvedInstallments?.filter((p) => isWeekend(p.dueDate)) ?? [];
  const splitBalanced = Math.abs(remainingLines) < 0.01;
  const splitValid =
    splitBalanced && lines.every((l) => l.amount > 0) && (aPrazoTotal === 0 || (parcels >= 1 && firstDueValid));

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
        <div className="card-feature">
          <label className="label">Arquivo XML da nota de compra (NFe)</label>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={(e) => {
              // Guarda contra bubbling: só reseta se o cursor realmente saiu da
              // dropzone (não apenas passou de um filho para outro). Combinada
              // com pointer-events-none nos filhos, evita o flicker/stutter de
              // dragOver alternando true/false a cada pixel cruzado.
              if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (busy) return;
              const file = e.dataTransfer.files?.[0];
              if (file) void processFile(file);
            }}
            className={`group mt-1 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 p-12 text-center transition-all duration-300 ${
              dragOver
                ? 'border-solid border-accent-400 bg-gradient-to-br from-brand-50 via-white to-accent-50 shadow-glow-gold'
                : 'border-dashed border-brand-200 bg-gradient-to-br from-white to-brand-50/40 hover:border-brand-400 hover:shadow-glow-brand'
            }`}
          >
            <span
              className={`pointer-events-none grid h-16 w-16 place-items-center rounded-2xl transition-all duration-300 ${
                dragOver ? 'icon-tile-gold animate-pop' : 'icon-tile group-hover:scale-110'
              }`}
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <UploadCloud className="h-8 w-8" />}
            </span>
            <span className="pointer-events-none font-display text-lg font-bold text-slate-800">
              {busy ? (
                'Lendo e processando a nota…'
              ) : dragOver ? (
                <span className="gradient-text-gold">Solte o arquivo para importar!</span>
              ) : (
                <>
                  Arraste o XML aqui <span className="gradient-text">ou clique para selecionar</span>
                </>
              )}
            </span>
            <span className="pointer-events-none text-xs text-slate-400">
              {fileName ? (
                <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                  <FileText className="h-3.5 w-3.5" /> {fileName}
                </span>
              ) : (
                'O sistema lê os itens, o fornecedor e as duplicatas automaticamente'
              )}
            </span>
            <div className="pointer-events-none mt-1 flex flex-wrap justify-center gap-2">
              <span className="badge-brand">NFe modelo 55</span>
              <span className="badge-gold">
                <Sparkles className="h-3.5 w-3.5" /> Leitura automática
              </span>
            </div>
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
                <div className="text-xs text-slate-500">{maskCpfCnpj(parsed.supplier.document)}</div>
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
            <label className="mt-3 block max-w-[200px]">
              <span className="label">Data de entrada</span>
              <input
                type="date"
                className="input"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </label>
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
              Para cada item, veja o custo anterior e o da nota. Informe um novo preço de venda ou a{' '}
              {pricingMode === 'margin' ? 'margem' : 'markup'} desejada — o outro campo se recalcula sozinho a
              partir do custo da nota. Deixe em branco para manter o atual.
            </p>
            {parsed.items.map((it, i) => {
              const v = mapping[i];
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap justify-between gap-1 text-sm">
                    <span className="font-medium">{v?.productName || it.description}</span>
                    {v?.description && <span className="text-slate-500 text-xs">{v.description}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
                    <InfoCell label="Custo anterior" value={v?.costPrice != null && v.costPrice > 0 ? brl(v.costPrice) : '—'} />
                    <InfoCell label="Custo na nota" value={brl(it.unitCost)} highlight />
                    <InfoCell label="P. venda atual" value={v?.salePrice != null && v.salePrice > 0 ? brl(v.salePrice) : '—'} />
                    <div>
                      <div className="text-slate-400 mb-0.5">Novo p. venda</div>
                      <NumInput
                        value={newPrices[i] ?? 0}
                        onChange={(price) => applyNewPrice(i, it.unitCost, price)}
                        placeholder={v?.salePrice != null && v.salePrice > 0 ? brl(v.salePrice) : 'Manter atual'}
                      />
                    </div>
                    <div>
                      <div className="text-slate-400 mb-0.5">{pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}</div>
                      <NumInput
                        value={newPct[i] ?? 0}
                        onChange={(pct) => applyNewPct(i, it.unitCost, pct)}
                        max={pricingMode === 'margin' ? 99.99 : undefined}
                        placeholder="0,00"
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

            {/* opção: gerar contas a pagar (split de formas + A_PRAZO, espelho do PDV) */}
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${financialMode === 'custom' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
              <input type="radio" className="mt-0.5 accent-brand-600" checked={financialMode === 'custom'} onChange={() => setFinancialMode('custom')} />
              <div className="flex-1">
                <div className="font-medium text-sm">Gerar contas a pagar</div>
                <div className="text-xs text-slate-500">Divida entre formas de pagamento e/ou parcele a prazo.</div>
                {financialMode === 'custom' && (
                  <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="mb-1 flex items-center justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-sm text-slate-500">Total da nota</span>
                      <span className="text-lg font-bold">{brl(financialTotal)}</span>
                    </div>

                    <div className="space-y-2">
                      {lines.map((l, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-400"
                            value={l.method}
                            onChange={(e) =>
                              setLines((prev) => prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))
                            }
                          >
                            {paymentTypes.map((t) => (
                              <option
                                key={t.code}
                                value={t.code}
                                disabled={t.code !== l.method && lines.some((x, j) => j !== i && x.method === t.code)}
                              >
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <NumInput
                            value={l.amount}
                            onChange={(v) => {
                              setLines((prev) => {
                                const next = prev.map((x, j) => (j === i ? { ...x, amount: v } : x));
                                if (i > 0 && next[0]) {
                                  const othersSum = round2(next.slice(1).reduce((a, x) => a + x.amount, 0));
                                  next[0] = { ...next[0], amount: Math.max(0, round2(financialTotal - othersSum)) };
                                }
                                return next;
                              });
                            }}
                            placeholder="0,00"
                          />
                          <button
                            type="button"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                            disabled={lines.length === 1}
                            onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-700 hover:underline"
                        onClick={() =>
                          setLines((prev) => [
                            ...prev,
                            { method: paymentTypes[0]?.code ?? 'CASH', amount: remainingLines > 0 ? remainingLines : 0 },
                          ])
                        }
                      >
                        + Adicionar forma
                      </button>
                      <span className={`text-sm font-semibold ${splitBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {splitBalanced
                          ? 'Pago integralmente'
                          : remainingLines > 0
                            ? `Falta ${brl(remainingLines)}`
                            : `Excede ${brl(-remainingLines)}`}
                      </span>
                    </div>

                    {/* Parcelamento da parte a prazo */}
                    {aPrazoTotal > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                        <div className="mb-2 text-sm font-semibold text-amber-700">A prazo: {brl(aPrazoTotal)}</div>
                        <div className="grid grid-cols-2 gap-2 overflow-hidden text-sm sm:grid-cols-3">
                          <label>
                            <span className="mb-1 block text-xs text-slate-500">Parcelas</span>
                            <IntegerInput
                              value={parcels}
                              onChange={(val) => {
                                setParcels(val);
                                setCustomDates({});
                                const parsedInt = conditionStr
                                  .split(/[\/\-,.]/)
                                  .map((n) => parseInt(n.trim(), 10))
                                  .filter((n) => !isNaN(n));
                                if (parsedInt.length > 1) {
                                  setConditionStr(String(parsedInt[0] ?? 30));
                                }
                              }}
                              min={1}
                              className="input h-9"
                            />
                          </label>
                          <label className="col-span-2 min-w-0 sm:col-span-1">
                            <span className="mb-1 block text-xs text-slate-500">1º vencimento *</span>
                            <input
                              type="date"
                              value={firstDue}
                              onChange={(e) => { setFirstDue(e.target.value); setCustomDates({}); }}
                              className={`input h-9 w-full min-w-0 ${!firstDueValid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20' : ''}`}
                            />
                            {!firstDueValid && (
                              <span className="mt-0.5 block text-xs font-medium text-rose-600">Informe a data</span>
                            )}
                          </label>
                          <label>
                            <span className="mb-1 block text-xs text-slate-500">Condição (dias)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={conditionStr}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConditionStr(val);
                                setCustomDates({});
                                const parsedInt = val
                                  .split(/[\/\-,.]/)
                                  .map((n) => parseInt(n.trim(), 10))
                                  .filter((n) => !isNaN(n));
                                if (parsedInt.length > 1) setParcels(parsedInt.length);
                              }}
                              placeholder="Ex: 30 ou 30/60/90"
                              className="input h-9"
                            />
                          </label>
                        </div>
                        {resolvedInstallments && (
                          <>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600">
                              {resolvedInstallments.map((p, i) => {
                                const wknd = isWeekend(p.dueDate);
                                return (
                                  <li key={i} className={`flex items-center justify-between gap-1 rounded px-1 ${wknd ? 'bg-amber-50 text-amber-700' : ''}`}>
                                    <div className="flex items-center gap-1">
                                      <span className="shrink-0">{i + 1}ª ·</span>
                                      <input
                                        type="date"
                                        value={p.dueDate}
                                        onChange={(e) => setCustomDates((prev) => ({ ...prev, [i]: e.target.value }))}
                                        className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-brand-400"
                                      />
                                      {wknd && <span>⚠️ fim de semana</span>}
                                    </div>
                                    <span className="font-medium">{brl(p.amount)}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            {weekendParcelas.length > 0 && (
                              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <strong>⚠️ {weekendParcelas.length} parcela(s) caem no fim de semana.</strong>
                                <br />Você pode prosseguir assim mesmo ou alterar a data do 1º vencimento.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
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
              disabled={busy || parsed.alreadyImported || (financialMode === 'custom' && !splitValid)}
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-300 ${
        active
          ? 'bg-brand-gradient text-white shadow-brand ring-2 ring-accent-300/70'
          : done
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-100 text-slate-400'
      }`}
    >
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

/**
 * Input numérico blindado (padrão antifraude do projeto): `type="text"` +
 * `inputMode="decimal"`, bloqueio de `-`/`+`/`e`/`E` no teclado, vírgula BR
 * via `sanitizeBr`, seleção total no foco e trava opcional de valor máximo
 * (usada para não deixar a margem passar de 99,99%).
 */
function NumInput({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  placeholder?: string;
}) {
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');
  const [raw, setRaw] = useState(() => toRaw(value));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(toRaw(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className="input h-8 text-sm w-full"
      value={raw}
      placeholder={placeholder}
      onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
      onChange={(e) => {
        const cleaned = sanitizeBr(e.target.value);
        let num = parseFloat(cleaned.replace(',', '.')) || 0;
        if (max !== undefined && num > max) {
          num = max;
          skipSync.current = true;
          setRaw(String(max).replace('.', ','));
          onChange(max);
          return;
        }
        setRaw(cleaned);
        skipSync.current = true;
        onChange(num);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}

/** Input inteiro blindado (nº de parcelas) — espelho do IntegerInput do PDV. */
function IntegerInput({
  value,
  onChange,
  min = 1,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  className?: string;
}) {
  const [raw, setRaw] = useState(() => String(value));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      className={className}
      onKeyDown={(e) => { if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault(); }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\D/g, '');
        setRaw(cleaned);
        skipSync.current = true;
        onChange(parseInt(cleaned, 10) || min);
      }}
      onFocus={(e) => e.target.select()}
    />
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
  // Busca pesada (nome/SKU/EAN) só dispara no Enter — `searchInput` guarda o
  // texto digitado, `search` é o valor efetivamente aplicado na query.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { onKeyDown: onSearchKeyDown } = useSearchHandler(setSearch);
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['product-picker-all', search, brand, group],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (brand.trim()) params.set('brand', brand.trim());
      if (group.trim()) params.set('group', group.trim());
      // Schema compartilhado (paginationQuery) limita pageSize a 100 — pedir
      // 200 derrubava a request com 400 "Dados inválidos" (lista sempre vazia).
      params.set('pageSize', '100');
      return api.get<{ items: ProductRow[] }>(`/api/products?${params}`);
    },
    staleTime: 30_000,
  });

  const products = data?.items ?? [];

  // Sugestões de Marca/Grupo derivadas do resultado já carregado — sem
  // round-trip extra de rede (não existe endpoint dedicado de valores únicos).
  const brandOptions = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.brand?.trim()).filter((b): b is string => !!b))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );
  const groupOptions = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.group?.trim()).filter((g): g is string => !!g))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-3xl flex h-auto max-h-[90dvh] flex-col overflow-hidden !p-0">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="font-display text-lg font-bold">Selecionar produto</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-4 space-y-4 md:p-6">
          {/* Filtros */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="relative sm:col-span-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input h-10 pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Buscar por nome, SKU, código de barras... (Enter para buscar)"
                autoFocus
              />
            </label>
            <SmartFilterInput value={brand} onChange={setBrand} options={brandOptions} placeholder="Filtrar marca" />
            <SmartFilterInput value={group} onChange={setGroup} options={groupOptions} placeholder="Filtrar grupo" />
          </div>

          {/* Lista */}
          <div className="space-y-1">
            {isLoading && <div className="py-8 text-center text-slate-400">Carregando produtos...</div>}
            {!isLoading && products.length === 0 && (
              <div className="py-8 text-center text-slate-400">Nenhum produto encontrado.</div>
            )}
            {products.map((p) =>
              p.variants.map((v) => (
                <button
                  key={v.id}
                  className="w-full rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50 transition"
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
    </div>,
    document.body,
  );
}

/**
 * Input de filtro com auto-suggest a partir de valores já carregados (marca/
 * grupo). O dropdown flutuante é `absolute` sobre um wrapper `relative`, então
 * nunca empurra o layout ao redor. `onBlur` fecha a lista com atraso de 150ms
 * para dar tempo do `onClick` da sugestão ser registrado antes de sumir.
 */
function SmartFilterInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [raw, setRaw] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setRaw(value), [value]);

  const term = raw.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.toLowerCase().includes(term)) : options;

  function commit(v: string) {
    setRaw(v);
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        className="input h-9 text-sm"
        value={raw}
        placeholder={placeholder}
        onChange={(e) => {
          setRaw(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(raw.trim());
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white shadow-lg rounded-md border border-slate-200 max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
              onClick={() => commit(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
