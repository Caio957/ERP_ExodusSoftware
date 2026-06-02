import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PaymentMethod } from '@exodus/shared';
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

const paymentOptions: { method: PaymentMethod; label: string; icon: string }[] = [
  { method: 'CASH', label: 'Dinheiro', icon: '💵' },
  { method: 'PIX', label: 'PIX', icon: '⚡' },
  { method: 'DEBIT', label: 'Débito', icon: '💳' },
  { method: 'CREDIT', label: 'Crédito', icon: '🪙' },
];

export function PdvPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ items: ReceiptItem[]; total: number; method: PaymentMethod } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current'],
    queryFn: () => api.get<CashRegister | null>('/api/cash/current'),
  });

  const { data: results } = useQuery({
    queryKey: ['product-search', search],
    queryFn: () => api.get<ProductSearchResult>(`/api/products?search=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const total = cart.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);

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

  async function finalize(method: PaymentMethod) {
    if (!register || cart.length === 0) return;
    const items = cart.map((c) => ({
      variantId: c.variantId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
    }));

    // Offline-first: enfileira e confirma imediatamente (Requisito 4.4).
    await enqueueSale({ cashRegisterId: register.id, paymentMethod: method, items });

    setLastSale({
      items: cart.map((c) => ({
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
      })),
      total,
      method,
    });
    setCart([]);
    flash('Venda registrada ✓');
  }

  if (isLoading) return <div className="p-8 text-center text-slate-500">Carregando caixa...</div>;

  if (!register) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <div className="mb-2 text-4xl">🔒</div>
        <h2 className="text-lg font-bold">Nenhum caixa aberto</h2>
        <p className="mb-4 text-slate-500">Abra o caixa para iniciar as vendas.</p>
        <a href="/caixa" className="btn-primary inline-flex">
          Ir para o Caixa
        </a>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      {/* Busca + resultados */}
      <section className="flex flex-col gap-3">
        <div className="card">
          <label className="mb-1 block text-sm font-medium text-slate-600">
            Escaneie o código de barras ou busque o produto
          </label>
          <input
            className="input text-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, marca ou SKU..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results?.items.flatMap((p) =>
            p.variants.map((v) => (
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
                className="card flex flex-col items-start gap-1 text-left hover:ring-brand-400"
              >
                <span className="text-xs text-slate-400">{p.brand}</span>
                <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-slate-500">{v.description}</span>
                <span className="mt-1 text-base font-bold text-brand-700">{brl(v.salePrice)}</span>
                <span className="text-xs text-slate-400">Estoque: {v.stockQty}</span>
              </button>
            )),
          )}
        </div>
      </section>

      {/* Carrinho */}
      <aside className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 p-4 text-lg font-bold">Carrinho</div>
        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-slate-400">Nenhum item. Escaneie ou toque em um produto.</p>
          ) : (
            <ul className="space-y-2">
              {cart.map((it) => (
                <li key={it.variantId} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 text-sm font-medium">{it.description}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost h-9 w-9 p-0" onClick={() => changeQty(it.variantId, -1)}>
                        −
                      </button>
                      <span className="w-6 text-center font-semibold">{it.quantity}</span>
                      <button className="btn-ghost h-9 w-9 p-0" onClick={() => changeQty(it.variantId, 1)}>
                        +
                      </button>
                    </div>
                    <span className="font-bold">{brl(it.unitPrice * it.quantity)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between text-xl font-bold">
            <span>Total</span>
            <span>{brl(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {paymentOptions.map((opt) => (
              <button
                key={opt.method}
                disabled={cart.length === 0}
                onClick={() => void finalize(opt.method)}
                className="btn-primary flex-col py-3"
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Modal de recibo pós-venda */}
      {lastSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-2xl bg-white p-4">
            <h3 className="mb-2 text-center text-lg font-bold">Venda concluída</h3>
            <ThermalReceipt
              items={lastSale.items}
              total={lastSale.total}
              paymentMethod={lastSale.method}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setLastSale(null)}>
                Fechar
              </button>
              <button className="btn-primary" onClick={() => printReceipt()}>
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
