import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentMethod } from '@exodus/shared';
import { Receipt, Pencil, Trash2, X, Plus, Minus, Search, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const methodLabel: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
};

interface SaleListItem {
  id: string;
  soldAt: string;
  paymentMethod: string;
  totalAmount: number;
  discount: number;
  surcharge: number;
  notes: string | null;
  client: { name: string } | null;
  items: Array<{ id: string }>;
}

export function SalesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get<{ items: SaleListItem[] }>('/api/sales?pageSize=100'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/sales/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  function handleDelete(s: SaleListItem) {
    if (
      window.confirm(
        `Excluir a venda de ${brl(s.totalAmount)}?\nO estoque será estornado e o financeiro vinculado removido.`,
      )
    ) {
      remove.mutate(s.id);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Vendas</h1>
        <p className="text-sm text-slate-500">Consulte, edite ou exclua as vendas registradas.</p>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">Data</th>
                <th>Pagamento</th>
                <th>Cliente</th>
                <th className="text-center">Itens</th>
                <th className="text-right">Total</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    {new Date(s.soldAt).toLocaleString('pt-BR')}
                    {s.notes && <div className="text-xs text-slate-400">{s.notes}</div>}
                  </td>
                  <td>
                    <span className="badge-neutral">{methodLabel[s.paymentMethod] ?? s.paymentMethod}</span>
                  </td>
                  <td className="text-slate-500">{s.client?.name ?? 'Balcão'}</td>
                  <td className="text-center">{s.items.length}</td>
                  <td className="text-right font-semibold">{brl(s.totalAmount)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                        onClick={() => setEditingId(s.id)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleDelete(s)}
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
                    <Receipt className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Nenhuma venda registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingId && (
        <EditSaleModal
          saleId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ['sales'] });
            qc.invalidateQueries({ queryKey: ['cash-current'] });
          }}
        />
      )}
    </div>
  );
}

interface EditItem {
  variantId: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

function EditSaleModal({
  saleId,
  onClose,
  onSaved,
}: {
  saleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<EditItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      const sale = await api.get<{
        paymentMethod: PaymentMethod;
        discount: number;
        surcharge: number;
        notes: string | null;
        clientId: string | null;
        items: Array<{
          variantId: string;
          quantity: number;
          unitPrice: number;
          variant: { description: string; product: { name: string } };
        }>;
      }>(`/api/sales/${saleId}`);
      setItems(
        sale.items.map((it) => ({
          variantId: it.variantId,
          description: `${it.variant.product.name} - ${it.variant.description}`,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      );
      setPaymentMethod(sale.paymentMethod);
      setDiscount(sale.discount);
      setSurcharge(sale.surcharge);
      setNotes(sale.notes ?? '');
      setClientId(sale.clientId);
      return sale;
    },
  });

  const { data: results } = useQuery({
    queryKey: ['sale-product-search', search],
    queryFn: () =>
      api.get<{
        items: Array<{ name: string; variants: Array<{ id: string; description: string; salePrice: number }> }>;
      }>(`/api/products?search=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const subtotal = items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const total = Math.max(0, round2(subtotal - discount + surcharge));

  function setItem(variantId: string, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it) => (it.variantId === variantId ? { ...it, ...patch } : it)));
  }
  function changeQty(variantId: string, delta: number) {
    setItems((prev) =>
      prev
        .map((it) => (it.variantId === variantId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0),
    );
  }
  function addVariant(v: { id: string; description: string; salePrice: number }, productName: string) {
    setItems((prev) => {
      const found = prev.find((it) => it.variantId === v.id);
      if (found) return prev.map((it) => (it.variantId === v.id ? { ...it, quantity: it.quantity + 1 } : it));
      return [
        ...prev,
        { variantId: v.id, description: `${productName} - ${v.description}`, unitPrice: v.salePrice, quantity: 1 },
      ];
    });
    setSearch('');
  }

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/sales/${saleId}`, {
        paymentMethod,
        clientId: clientId ?? undefined,
        items: items.map((it) => ({ variantId: it.variantId, quantity: it.quantity, unitPrice: it.unitPrice })),
        discount: round2(discount),
        surcharge: round2(surcharge),
        notes: notes.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl animate-scale-in overflow-auto rounded-2xl bg-white p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Editar venda</h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Ao salvar, o estoque é reajustado e o financeiro vinculado a esta venda é refeito.
        </div>

        {isLoading ? (
          <div className="grid h-32 place-items-center text-slate-500">Carregando venda...</div>
        ) : (
          <>
            {/* Itens */}
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.variantId} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{it.description}</span>
                    <button
                      className="text-slate-300 hover:text-rose-500"
                      onClick={() => setItems((prev) => prev.filter((x) => x.variantId !== it.variantId))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-slate-200"
                        onClick={() => changeQty(it.variantId, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center font-bold">{it.quantity}</span>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg bg-white ring-1 ring-slate-200"
                        onClick={() => changeQty(it.variantId, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => setItem(it.variantId, { unitPrice: Math.max(0, Number(e.target.value)) })}
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-brand-400"
                      />
                    </div>
                    <span className="w-20 text-right font-bold">{brl(it.unitPrice * it.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* Adicionar item */}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input h-10 pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Adicionar produto à venda..."
              />
              {results && search.trim().length >= 2 && (
                <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200">
                  {results.items.flatMap((p) =>
                    p.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => addVariant(v, p.name)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {p.name} — {v.description}{' '}
                        <span className="text-brand-600">{brl(v.salePrice)}</span>
                      </button>
                    )),
                  )}
                </div>
              )}
            </div>

            {/* Totais e pagamento */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-700">{brl(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-600">Desconto (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none"
                  placeholder="0,00"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-600">Acréscimo (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={surcharge || ''}
                  onChange={(e) => setSurcharge(Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none"
                  placeholder="0,00"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Forma de pagamento</span>
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 outline-none"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {(['CASH', 'PIX', 'DEBIT', 'CREDIT'] as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {methodLabel[m]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="input h-10 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação da venda"
                maxLength={500}
              />
              <div className="flex justify-between pt-1 text-lg font-bold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={save.isPending || items.length === 0}
                onClick={() => save.mutate()}
              >
                {save.isPending ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
