import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Search, Check } from 'lucide-react';
import { api, ApiError } from '../lib/api';

interface VariantHit {
  id: string;
  label: string;
  stockQty: number;
}

export function StockAdjustPage() {
  const qc = useQueryClient();
  const [variant, setVariant] = useState<VariantHit | null>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const adjust = useMutation({
    mutationFn: () =>
      api.post('/api/products/adjust-stock', {
        variantId: variant!.id,
        newQuantity: Number(newQuantity),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setDone(true);
      setVariant(null);
      setNewQuantity('');
      setReason('');
      window.setTimeout(() => setDone(false), 3000);
    },
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : 'Falha no acerto'),
  });

  function submit() {
    setLocalError(null);
    if (!variant) return setLocalError('Selecione o produto.');
    if (newQuantity === '' || Number(newQuantity) < 0) return setLocalError('Informe a quantidade contada.');
    if (reason.trim().length < 1) return setLocalError('Informe o motivo do acerto.');
    adjust.mutate();
  }

  const diff = variant ? Number(newQuantity || 0) - variant.stockQty : 0;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
          <ClipboardCheck className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Acerto de estoque</h1>
          <p className="text-sm text-slate-500">Ajuste a quantidade pela contagem física (inventário).</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <span className="label">Produto *</span>
          {variant ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <span>
                {variant.label} · <strong>estoque atual: {variant.stockQty}</strong>
              </span>
              <button className="text-xs underline" onClick={() => setVariant(null)}>
                trocar
              </button>
            </div>
          ) : (
            <ProductSearch onPick={setVariant} />
          )}
        </div>

        {variant && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Quantidade contada *</span>
                <input
                  className="input text-lg"
                  type="number"
                  inputMode="numeric"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </label>
              <div className="flex flex-col justify-end">
                <span className="label">Diferença</span>
                <div
                  className={`flex h-11 items-center rounded-xl px-3 font-bold ${
                    diff === 0
                      ? 'bg-slate-100 text-slate-500'
                      : diff > 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </div>
              </div>
            </div>
            <label className="block">
              <span className="label">Motivo do acerto *</span>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: contagem de inventário, perda, quebra..."
              />
            </label>
          </>
        )}

        {(localError || adjust.error instanceof ApiError) && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {localError ?? (adjust.error as ApiError).message}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {done && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Estoque ajustado!
            </span>
          )}
          <button className="btn-primary" disabled={adjust.isPending || !variant} onClick={submit}>
            {adjust.isPending ? 'Ajustando...' : 'Confirmar acerto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductSearch({ onPick }: { onPick: (v: VariantHit) => void }) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['adjust-product-search', term],
    queryFn: () =>
      api.get<{
        items: Array<{ name: string; variants: Array<{ id: string; description: string; sku: string; stockQty: number }> }>;
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
        placeholder="Buscar produto..."
      />
      {data && term.trim().length >= 2 && (
        <div className="mt-1 max-h-44 overflow-auto rounded-xl border border-slate-200">
          {data.items.flatMap((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => onPick({ id: v.id, label: `${p.name} — ${v.description}`, stockQty: v.stockQty })}
              >
                <span>
                  {p.name} — {v.description} <span className="text-slate-400">({v.sku})</span>
                </span>
                <span className="text-xs text-slate-400">est. {v.stockQty}</span>
              </button>
            )),
          )}
          {data.items.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Nenhum produto encontrado.</div>}
        </div>
      )}
    </div>
  );
}
