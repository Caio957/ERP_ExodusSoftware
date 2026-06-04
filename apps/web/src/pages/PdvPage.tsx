import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PaymentMethod } from '@exodus/shared';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Banknote,
  Zap,
  CreditCard,
  Coins,
  Printer,
  X,
  CheckCircle2,
  Lock,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { lookupByBarcode } from '../lib/products';
import { enqueueSale } from '../lib/sync';
import { ThermalReceipt, printReceipt, type ReceiptItem } from '../components/ThermalReceipt';

interface CartItem {
  variantId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  stockQty: number;
}

interface CashRegister {
  id: string;
  initialCash: number;
}

interface ProductSearchResult {
  items: Array<{
    id: string;
    name: string;
    brand: string;
    variants: Array<{
      id: string;
      description: string;
      salePrice: number;
      stockQty: number;
      barcode: string | null;
    }>;
  }>;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const paymentOptions: {
  method: PaymentMethod;
  label: string;
  icon: LucideIcon;
  classes: string;
}[] = [
  { method: 'CASH', label: 'Dinheiro', icon: Banknote, classes: 'from-emerald-500 to-emerald-600' },
  { method: 'PIX', label: 'PIX', icon: Zap, classes: 'from-teal-500 to-cyan-600' },
  { method: 'DEBIT', label: 'Débito', icon: CreditCard, classes: 'from-sky-500 to-blue-600' },
  { method: 'CREDIT', label: 'Crédito', icon: Coins, classes: 'from-violet-500 to-brand-600' },
];

export function PdvPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0); // R$
  const [surcharge, setSurcharge] = useState(0); // R$
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{
    items: ReceiptItem[];
    total: number;
    method: PaymentMethod;
  } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current'],
    queryFn: () => api.get<CashRegister | null>('/api/cash/current'),
  });

  // Busca: campo vazio lista todos os produtos (Requisito B1).
  const { data: results } = useQuery({
    queryKey: ['product-search', search],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: '60' });
      if (search.trim()) qs.set('search', search.trim());
      return api.get<ProductSearchResult>(`/api/products?${qs.toString()}`);
    },
  });

  const subtotal = cart.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const total = Math.max(0, round2(subtotal - discount + surcharge));
  const itemCount = cart.reduce((acc, it) => acc + it.quantity, 0);
  const discountPct = subtotal > 0 ? round2((discount / subtotal) * 100) : 0;
  const surchargePct = subtotal > 0 ? round2((surcharge / subtotal) * 100) : 0;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function addItem(item: Omit<CartItem, 'quantity'>) {
    setCart((prev) => {
      const existing = prev.find((p) => p.variantId === item.variantId);
      if (existing) {
        return prev.map((p) =>
          p.variantId === item.variantId ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  // Leitor de código de barras Bluetooth (teclado global).
  useBarcodeScanner(async (code) => {
    const variant = await lookupByBarcode(code);
    if (!variant) {
      flash(`Código ${code} não encontrado`);
      return;
    }
    addItem({
      variantId: variant.id,
      description: `${variant.productName} - ${variant.description}`,
      unitPrice: variant.salePrice,
      stockQty: variant.stockQty,
    });
    flash(`+ ${variant.description}`);
  });

  function changeQty(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((p) => (p.variantId === variantId ? { ...p, quantity: p.quantity + delta } : p))
        .filter((p) => p.quantity > 0),
    );
  }

  function changeUnitPrice(variantId: string, value: number) {
    setCart((prev) =>
      prev.map((p) => (p.variantId === variantId ? { ...p, unitPrice: Math.max(0, value) } : p)),
    );
  }

  function removeItem(variantId: string) {
    setCart((prev) => prev.filter((p) => p.variantId !== variantId));
  }

  function resetSale() {
    setCart([]);
    setDiscount(0);
    setSurcharge(0);
    setNotes('');
  }

  async function finalize(method: PaymentMethod) {
    if (!register || cart.length === 0) return;
    const items = cart.map((c) => ({
      variantId: c.variantId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
    }));

    // Offline-first: enfileira e confirma imediatamente (Requisito 4.4).
    await enqueueSale({
      cashRegisterId: register.id,
      paymentMethod: method,
      items,
      discount: round2(discount),
      surcharge: round2(surcharge),
      notes: notes.trim() || undefined,
    });

    setLastSale({
      items: cart.map((c) => ({
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
      })),
      total,
      method,
    });
    resetSale();
    flash('Venda registrada ✓');
  }

  if (isLoading)
    return <div className="grid h-64 place-items-center text-slate-500">Carregando caixa...</div>;

  if (!register) {
    return (
      <div className="grid h-full place-items-center">
        <div className="card max-w-md animate-scale-in text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Nenhum caixa aberto</h2>
          <p className="mb-5 mt-1 text-slate-500">Abra o caixa para iniciar as vendas do dia.</p>
          <a href="/caixa" className="btn-primary inline-flex">
            Ir para o Caixa
          </a>
        </div>
      </div>
    );
  }

  const allVariants = results?.items.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v })),
  );

  return (
    <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
      {/* Busca + resultados */}
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="page-title">Ponto de venda</h1>
          <p className="text-sm text-slate-500">Escaneie um código de barras ou busque o produto.</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-12 text-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, marca ou SKU (vazio = todos)..."
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {allVariants?.map(({ product: p, variant: v }) => {
            const out = v.stockQty <= 0;
            return (
              <button
                key={v.id}
                onClick={() =>
                  addItem({
                    variantId: v.id,
                    description: `${p.name} - ${v.description}`,
                    unitPrice: v.salePrice,
                    stockQty: v.stockQty,
                  })
                }
                className="card-hover flex flex-col items-start gap-1 text-left"
              >
                <span className="badge-brand mb-1">{p.brand}</span>
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</span>
                <span className="text-xs text-slate-500">{v.description}</span>
                <span className="mt-auto pt-2 text-lg font-bold text-brand-700">{brl(v.salePrice)}</span>
                <span className={`text-xs font-medium ${out ? 'text-rose-500' : 'text-slate-400'}`}>
                  {out ? 'Sem estoque' : `Estoque: ${v.stockQty}`}
                </span>
              </button>
            );
          })}
          {allVariants && allVariants.length === 0 && (
            <div className="col-span-full grid place-items-center rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
              <div>
                <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-600">
                  {search.trim() ? `Nada encontrado para “${search}”.` : 'Nenhum produto cadastrado.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Carrinho */}
      <aside className="flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-elevated lg:max-h-[calc(100vh-7rem)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-brand-600" />
            Carrinho
          </div>
          {itemCount > 0 && <span className="badge-brand">{itemCount} itens</span>}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center py-12 text-center">
              <div>
                <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">
                  Nenhum item ainda.
                  <br />
                  Escaneie ou toque em um produto.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((it) => (
                <li
                  key={it.variantId}
                  className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-brand-200"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{it.description}</span>
                    <button
                      className="shrink-0 text-slate-300 transition hover:text-rose-500"
                      onClick={() => removeItem(it.variantId)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition active:scale-90 hover:text-brand-600"
                        onClick={() => changeQty(it.variantId, -1)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-bold">{it.quantity}</span>
                      <button
                        className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition active:scale-90 hover:text-brand-600"
                        onClick={() => changeQty(it.variantId, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {/* Valor unitário editável (Requisito B4) */}
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-slate-400">R$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => changeUnitPrice(it.variantId, Number(e.target.value))}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-medium outline-none focus:border-brand-400"
                        title="Valor unitário"
                      />
                    </div>
                    <span className="w-20 text-right font-bold text-slate-800">
                      {brl(it.unitPrice * it.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          {/* Desconto / Acréscimo / Observação */}
          {cart.length > 0 && (
            <div className="mb-3 space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-700">{brl(subtotal)}</span>
              </div>
              <AdjustRow
                label="Desconto"
                amount={discount}
                pct={discountPct}
                tone="rose"
                onAmount={(v) => setDiscount(Math.min(v, subtotal))}
                onPct={(p) => setDiscount(round2((subtotal * Math.min(p, 100)) / 100))}
              />
              <AdjustRow
                label="Acréscimo"
                amount={surcharge}
                pct={surchargePct}
                tone="emerald"
                onAmount={(v) => setSurcharge(v)}
                onPct={(p) => setSurcharge(round2((subtotal * p) / 100))}
              />
              <input
                className="input h-10 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação da venda (opcional)"
                maxLength={500}
              />
            </div>
          )}

          <div className="mb-3 flex items-end justify-between">
            <span className="text-sm font-medium text-slate-500">Total a pagar</span>
            <span className="font-display text-3xl font-extrabold text-slate-900">{brl(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((opt) => (
              <button
                key={opt.method}
                disabled={cart.length === 0}
                onClick={() => void finalize(opt.method)}
                className={`flex min-h-touch items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${opt.classes} px-3 py-3 font-semibold text-white shadow-soft transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40`}
              >
                <opt.icon className="h-5 w-5" />
                <span className="text-sm">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-elevated animate-slide-up">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Modal de recibo pós-venda */}
      {lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-sm animate-scale-in overflow-auto rounded-2xl bg-white p-5 shadow-elevated">
            <div className="mb-3 flex flex-col items-center text-center">
              <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold">Venda concluída!</h3>
              <p className="text-sm text-slate-500">{brl(lastSale.total)} registrados</p>
            </div>
            <ThermalReceipt items={lastSale.items} total={lastSale.total} paymentMethod={lastSale.method} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setLastSale(null)}>
                <X className="h-4 w-4" /> Fechar
              </button>
              <button className="btn-primary" onClick={() => printReceipt()}>
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Linha de ajuste (desconto/acréscimo) com entrada em R$ e em %. */
function AdjustRow({
  label,
  amount,
  pct,
  tone,
  onAmount,
  onPct,
}: {
  label: string;
  amount: number;
  pct: number;
  tone: 'rose' | 'emerald';
  onAmount: (v: number) => void;
  onPct: (v: number) => void;
}) {
  const color = tone === 'rose' ? 'text-rose-600' : 'text-emerald-600';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`font-medium ${color}`}>{label}</span>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
          <span className="text-xs text-slate-400">R$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount || ''}
            onChange={(e) => onAmount(Number(e.target.value) || 0)}
            className="w-16 py-1 text-right outline-none"
            placeholder="0,00"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={pct || ''}
            onChange={(e) => onPct(Number(e.target.value) || 0)}
            className="w-12 py-1 text-right outline-none"
            placeholder="0"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>
    </div>
  );
}
