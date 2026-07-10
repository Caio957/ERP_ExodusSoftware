import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Search, Check, History, Pencil, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSearchHandler } from '../hooks/useSearchHandler';

interface VariantHit {
  id: string;
  label: string;
  stockQty: number;
}

type MovementType = 'BALANCE' | 'IN' | 'OUT';

interface Adjustment {
  id: string;
  code: number | null;
  variantId: string;
  quantity: number; // diferença aplicada (+/-)
  reason: string;
  createdAt: string;
  product: string;
  description: string;
  sku: string;
  currentStock: number;
}

export function StockAdjustPage() {
  const qc = useQueryClient();
  const [variant, setVariant] = useState<VariantHit | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('BALANCE');
  const [newQuantity, setNewQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Adjustment | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
  };

  const adjust = useMutation({
    mutationFn: () =>
      api.post('/api/products/adjust-stock', {
        variantId: variant!.id,
        newQuantity: computedNewQuantity,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setDone(true);
      setVariant(null);
      setMovementType('BALANCE');
      setNewQuantity('');
      setReason('');
      window.setTimeout(() => setDone(false), 3000);
    },
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : 'Falha no acerto'),
  });

  function submit() {
    setLocalError(null);
    if (!variant) return setLocalError('Selecione o produto.');
    const qtyLabel = movementType === 'IN' ? 'a quantidade de entrada' : movementType === 'OUT' ? 'a quantidade de saída' : 'a quantidade contada';
    if (newQuantity === '' || Number(newQuantity) < 0) return setLocalError(`Informe ${qtyLabel}.`);
    if (reason.trim().length < 1) return setLocalError('Informe o motivo do acerto.');
    adjust.mutate();
  }

  const computedNewQuantity = variant
    ? movementType === 'IN'
      ? variant.stockQty + Number(newQuantity || 0)
      : movementType === 'OUT'
        ? variant.stockQty - Number(newQuantity || 0)
        : Number(newQuantity || 0)
    : 0;

  const diff = variant ? computedNewQuantity - variant.stockQty : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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
            <div>
              <span className="label">Tipo de movimentação *</span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'BALANCE', label: 'Balanço/Inventário' },
                    { value: 'IN', label: 'Entrada' },
                    { value: 'OUT', label: 'Saída' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      movementType === opt.value
                        ? 'border-brand-500 bg-brand-gradient text-white shadow-brand'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-accent-400 hover:text-accent-600'
                    }`}
                    onClick={() => setMovementType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">
                  {movementType === 'IN'
                    ? 'Quantidade de entrada *'
                    : movementType === 'OUT'
                      ? 'Quantidade de saída *'
                      : 'Quantidade contada *'}
                </span>
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

      {/* Histórico de acertos */}
      <AdjustmentsHistory onEdit={setEditing} />

      {editing && (
        <EditAdjustmentModal
          adjustment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function AdjustmentsHistory({ onEdit }: { onEdit: (a: Adjustment) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => api.get<Adjustment[]>('/api/products/stock-adjustments'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/products/stock-adjustments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao apagar'),
  });

  // Paginação client-side (padrão Tray, mesmo motor de Vendas/Financeiro/
  // Compras/Produtos) — o backend retorna os últimos 200 acertos de uma vez,
  // sem page/pageSize.
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Tamanho de página mudou → volta pra primeira página.
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil((data?.length ?? 0) / itemsPerPage));

  // Rede de segurança: se totalPages encolher (novo pageSize), evita página fantasma.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paginatedAdjustments = (data ?? []).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <History className="h-5 w-5 text-brand-600" /> Acertos realizados
      </div>
      {isLoading ? (
        <div className="grid h-20 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2 whitespace-nowrap">Cód.</th>
                <th>Produto</th>
                <th>Motivo</th>
                <th>Data</th>
                <th className="text-center">Ajuste</th>
                <th className="text-center">Estoque atual</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAdjustments.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 whitespace-nowrap">
                    <span className="font-medium text-slate-700">{a.code ? `#${a.code}` : '—'}</span>
                  </td>
                  <td>
                    <div className="font-medium">{a.product}</div>
                    <div className="text-xs text-slate-400">
                      {a.description} · {a.sku}
                    </div>
                  </td>
                  <td className="text-slate-500">{a.reason}</td>
                  <td className="text-slate-500">{new Date(a.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.quantity > 0 ? 'bg-emerald-50 text-emerald-600' : a.quantity < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.quantity > 0 ? `+${a.quantity}` : a.quantity}
                    </span>
                  </td>
                  <td className="text-center font-medium">{a.currentStock}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                        onClick={() => onEdit(a)}
                        title="Editar acerto"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => {
                          if (window.confirm('Apagar este acerto? O estoque será recalculado (a diferença será revertida).'))
                            remove.mutate(a.id);
                        }}
                        title="Apagar acerto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhum acerto realizado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Linhas por página
            <select
              className="input h-9 w-auto py-1"
              value={String(itemsPerPage)}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
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
  );
}

function EditAdjustmentModal({
  adjustment,
  onClose,
  onSaved,
}: {
  adjustment: Adjustment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(String(adjustment.quantity));
  const [reason, setReason] = useState(adjustment.reason);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/products/stock-adjustments/${adjustment.id}`, {
        quantity: Math.trunc(Number(quantity)),
        reason: reason.trim(),
      }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  const delta = Math.trunc(Number(quantity || 0)) - adjustment.quantity;
  const projected = adjustment.currentStock + delta;

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Editar acerto</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div className="font-medium">{adjustment.product}</div>
          <div className="text-xs text-slate-400">
            {adjustment.description} · estoque atual {adjustment.currentStock}
          </div>
        </div>

        <label className="block">
          <span className="label">Ajuste aplicado (+/−)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label className="mt-3 block">
          <span className="label">Motivo</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {delta !== 0 && (
          <div className="mt-3 rounded-lg bg-brand-50/60 px-3 py-2 text-sm text-brand-700">
            O estoque será recalculado: {adjustment.currentStock} → <strong>{projected}</strong> ({delta > 0 ? `+${delta}` : delta}).
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={save.isPending || reason.trim().length < 1}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductSearch({ onPick }: { onPick: (v: VariantHit) => void }) {
  const [term, setTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['adjust-product-search', searchTerm],
    queryFn: () =>
      api.get<{
        items: Array<{ name: string; variants: Array<{ id: string; description: string; sku: string; stockQty: number }> }>;
      }>(`/api/products?search=${encodeURIComponent(searchTerm ?? '')}`),
    enabled: searchTerm !== null,
  });
  const { onKeyDown } = useSearchHandler(setSearchTerm);

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault(); // Impede o reload da página
        setSearchTerm(term.trim());
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className="input pl-9"
        type="search"
        enterKeyHint="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Buscar produto... (Enter para filtrar)"
      />
      {data && searchTerm !== null && (
        <div className="mt-1 max-h-44 overflow-auto rounded-xl border border-slate-200">
          {data.items.flatMap((p) =>
            p.variants.map((v) => (
              <button
                key={v.id}
                type="button"
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
    </form>
  );
}
