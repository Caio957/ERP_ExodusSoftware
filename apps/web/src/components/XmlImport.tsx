import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

export function XmlImport() {
  const [xml, setXml] = useState('');
  const [parsed, setParsed] = useState<ParsedNfe | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  async function handleParse() {
    setFeedback(null);
    setBusy(true);
    try {
      const data = await api.post<ParsedNfe>('/api/invoices/parse', { xml });
      setParsed(data);
      const initial: Record<number, string> = {};
      data.items.forEach((it, i) => {
        if (it.matchedVariantId) initial[i] = it.matchedVariantId;
      });
      setMapping(initial);
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof ApiError ? err.message : 'Falha ao processar XML' });
    } finally {
      setBusy(false);
    }
  }

  const allMapped = parsed?.items.every((_, i) => mapping[i]);

  async function handleConfirm() {
    if (!parsed) return;
    setBusy(true);
    setFeedback(null);
    try {
      // Garante o fornecedor cadastrado (cria a partir do XML se necessário).
      let supplierId = parsed.supplier.existingId;
      if (!supplierId) {
        const created = await api.post<{ id: string }>('/api/persons', {
          type: 'SUPPLIER',
          name: parsed.supplier.name,
          document: parsed.supplier.document,
        });
        supplierId = created.id;
      }

      await api.post('/api/invoices/confirm', {
        supplierId,
        accessKey: parsed.accessKey,
        issueDate: parsed.issueDate,
        totalAmount: parsed.totalAmount,
        items: parsed.items.map((it, i) => ({
          variantId: mapping[i],
          quantity: it.quantity,
          unitCost: it.unitCost,
          cfop: it.cfop,
          supplierItemCode: it.supplierItemCode,
          supplierBarcode: it.supplierBarcode,
          saveMapping: true,
        })),
        duplicates: parsed.duplicates.map((d) => ({
          number: d.number,
          dueDate: d.dueDate,
          amount: d.amount,
        })),
      });

      setFeedback({ type: 'ok', msg: 'Entrada confirmada! Estoque e Contas a Pagar atualizados.' });
      setParsed(null);
      setXml('');
    } catch (err) {
      setFeedback({ type: 'err', msg: err instanceof ApiError ? err.message : 'Falha ao confirmar' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!parsed && (
        <div className="card">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Cole o conteúdo do XML da NFe
          </label>
          <textarea
            className="input h-40 resize-y py-2 font-mono text-xs"
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            placeholder="<nfeProc>...</nfeProc>"
          />
          <button className="btn-primary mt-3" disabled={!xml || busy} onClick={handleParse}>
            {busy ? 'Processando...' : 'Processar XML'}
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {parsed && (
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
              </div>
            </div>
            {parsed.alreadyImported && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                ⚠️ Esta nota já foi importada anteriormente.
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-semibold">Itens — associe o De/Para</div>
            {parsed.items.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{it.description}</span>
                  <span className="text-slate-500">
                    {it.quantity} × {brl(it.unitCost)} · CFOP {it.cfop}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Cód. forn.: {it.supplierItemCode} · EAN: {it.supplierBarcode ?? '—'}
                </div>
                <VariantPicker
                  selectedId={mapping[i]}
                  matched={!!it.matchedVariantId}
                  onSelect={(id) => setMapping((m) => ({ ...m, [i]: id }))}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setParsed(null)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              disabled={!allMapped || busy || parsed.alreadyImported}
              onClick={handleConfirm}
            >
              {busy ? 'Confirmando...' : 'Confirmar entrada'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Seletor de variante (busca produtos) para resolver o De/Para de um item. */
function VariantPicker({
  selectedId,
  matched,
  onSelect,
}: {
  selectedId?: string;
  matched: boolean;
  onSelect: (variantId: string) => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['variant-picker', term],
    queryFn: () =>
      api.get<{ items: Array<{ name: string; variants: Array<{ id: string; description: string; sku: string }> }> }>(
        `/api/products?search=${encodeURIComponent(term)}`,
      ),
    enabled: term.trim().length >= 2,
  });

  if (selectedId) {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <span>✓ Associado {matched ? '(automático)' : ''}</span>
        <button className="text-xs underline" onClick={() => onSelect('')}>
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <input
        className="input h-10"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Buscar produto local para associar..."
      />
      {data && term.length >= 2 && (
        <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200">
          {data.items.flatMap((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {p.name} — {v.description} <span className="text-slate-400">({v.sku})</span>
              </button>
            )),
          )}
        </div>
      )}
    </div>
  );
}
