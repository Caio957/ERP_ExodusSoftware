import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type PaymentType, DEFAULT_PAYMENT_TYPES } from '@exodus/shared';
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
  User,
  Layers,
  Trash,
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
  openedAt: string;
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

// Estilo (ícone/cor) dos métodos base; tipos customizados usam o padrão.
const methodStyle: Record<string, { icon: LucideIcon; classes: string }> = {
  CASH: { icon: Banknote, classes: 'from-emerald-500 to-teal-600' },
  PIX: { icon: Zap, classes: 'from-teal-500 to-cyan-600' },
  DEBIT: { icon: CreditCard, classes: 'from-sky-500 to-blue-600' },
  CREDIT: { icon: Coins, classes: 'from-blue-600 to-indigo-700' },
  A_PRAZO: { icon: Layers, classes: 'from-accent-400 to-accent-600' },
};
const defaultStyle = { icon: Coins, classes: 'from-brand-500 to-brand-700' };

export function PdvPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0); // R$
  const [surcharge, setSurcharge] = useState(0); // R$
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{
    items: ReceiptItem[];
    total: number;
    method: string;
  } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current'],
    queryFn: () => api.get<CashRegister | null>('/api/cash/current'),
  });

  // Tipos de recebimento configuráveis (Configurações → Recebimentos).
  const { data: ptData } = useQuery({
    queryKey: ['payment-types'],
    queryFn: () => api.get<{ types: PaymentType[] }>('/api/settings/payment-types'),
  });
  const paymentTypes = (ptData?.types ?? DEFAULT_PAYMENT_TYPES).filter((t) => t.active);
  const quickTypes = paymentTypes.filter((t) => t.kind !== 'A_PRAZO');

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
    setClient(null);
  }

  async function doSale(
    payments: { method: string; amount: number }[],
    installments?: { dueDate: string; amount: number }[],
  ) {
    if (!register || cart.length === 0) return;
    const items = cart.map((c) => ({
      variantId: c.variantId,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
    }));

    // Offline-first: enfileira e confirma imediatamente (Requisito 4.4).
    await enqueueSale({
      cashRegisterId: register.id,
      paymentMethod: payments[0]!.method,
      payments,
      installments: installments?.map((i) => ({ dueDate: new Date(i.dueDate), amount: i.amount })),
      items,
      clientId: client?.id,
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
      method: payments.length === 1 ? payments[0]!.method : 'SPLIT',
    });
    resetSale();
    setShowPayment(false);
    flash('Venda registrada ✓');
  }

  /** Caminho rápido: pagamento único à vista. */
  function finalize(method: string) {
    void doSale([{ method, amount: round2(total) }]);
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

  // Detecta caixa aberto de outro dia (exige fechamento antes de continuar).
  const today = new Date().toDateString();
  const registerDay = register ? new Date(register.openedAt).toDateString() : null;
  const isStaleRegister = registerDay !== null && registerDay !== today;

  const allVariants = results?.items.flatMap((p) =>
    p.variants.map((v) => ({ product: p, variant: v })),
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
      {/* Alerta de caixa do dia anterior */}
      {isStaleRegister && (
        <div className="col-span-full animate-scale-in rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-bold text-amber-800">⚠️ Caixa do dia anterior ainda aberto</div>
              <p className="mt-0.5 text-sm text-amber-700">
                O caixa foi aberto em{' '}
                <strong>{new Date(register!.openedAt).toLocaleDateString('pt-BR')}</strong> e ainda não foi
                fechado. Para manter o controle financeiro organizado, feche o caixa antes de iniciar as
                vendas de hoje.
              </p>
            </div>
            <a href="/caixa" className="btn-gold shrink-0 text-sm">
              Ir para o Caixa →
            </a>
          </div>
        </div>
      )}

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

      {/* Carrinho — no mobile flui naturalmente; no desktop fica fixo (sticky) */}
      <aside className="flex flex-col rounded-2xl border border-white/60 bg-white shadow-elevated lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-brand-600" />
            Carrinho
          </div>
          {itemCount > 0 && <span className="badge-brand">{itemCount} itens</span>}
        </div>

        {/* Seletor de cliente da venda */}
        <div className="border-b border-slate-100 px-3 py-2">
          <ClientPicker client={client} onChange={setClient} onToast={flash} />
        </div>

        <div className="p-3 lg:flex-1 lg:overflow-auto">
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
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0 items-center gap-1.5">
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
                    <div className="flex shrink-0 items-center gap-1 text-sm">
                      <span className="text-slate-400">R$</span>
                      <UnitPriceInput
                        value={it.unitPrice}
                        onChange={(v) => changeUnitPrice(it.variantId, v)}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-right font-bold text-slate-800">
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
            {quickTypes.map((opt) => {
              const st = methodStyle[opt.code] ?? defaultStyle;
              return (
                <button
                  key={opt.code}
                  disabled={cart.length === 0}
                  onClick={() => setConfirmMethod(opt.code)}
                  className={`flex min-h-touch items-center justify-center gap-2 rounded-xl bg-gradient-to-br ${st.classes} px-3 py-3 font-semibold text-white shadow-soft transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40`}
                >
                  <st.icon className="h-5 w-5" />
                  <span className="text-sm">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <Layers className="h-4 w-4" /> Dividir pagamento / A prazo
          </button>
        </div>
      </aside>

      {/* Modal de confirmação rápida (pagamento à vista) */}
      {confirmMethod && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm animate-slide-up rounded-2xl bg-white p-6 shadow-elevated sm:animate-scale-in">
            <h3 className="mb-1 font-display text-lg font-bold">Confirmar venda?</h3>
            <p className="mb-4 text-sm text-slate-500">
              Revise os dados antes de finalizar.
            </p>
            <div className="mb-4 space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Itens</span>
                <span className="font-medium">{cart.reduce((a, it) => a + it.quantity, 0)}</span>
              </div>
              {client && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente</span>
                  <span className="font-medium">{client.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Pagamento</span>
                <span className="font-medium">{paymentTypes.find((t) => t.code === confirmMethod)?.label ?? confirmMethod}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Desconto</span>
                  <span>- {brl(discount)}</span>
                </div>
              )}
              {surcharge > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Acréscimo</span>
                  <span>+ {brl(surcharge)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
                <span>Total</span>
                <span>{brl(total)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirmMethod(null)}>
                Voltar e revisar
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setConfirmMethod(null);
                  void finalize(confirmMethod);
                }}
              >
                Confirmar venda
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          hasClient={!!client}
          types={paymentTypes}
          onClose={() => setShowPayment(false)}
          onConfirm={(payments, installments) => void doSale(payments, installments)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-elevated animate-slide-up md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Modal de recibo pós-venda */}
      {lastSale && (
        <div className="modal-overlay">
          <div className="modal-sheet sm:max-w-sm">
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

/** Modal de pagamento: múltiplas formas (split) + parcelamento "A prazo". */
function PaymentModal({
  total,
  hasClient,
  types,
  onClose,
  onConfirm,
}: {
  total: number;
  hasClient: boolean;
  types: PaymentType[];
  onClose: () => void;
  onConfirm: (
    payments: { method: string; amount: number }[],
    installments?: { dueDate: string; amount: number }[],
  ) => void;
}) {
  const firstCode = types[0]?.code ?? 'CASH';
  const [lines, setLines] = useState<{ method: string; amount: number }[]>([
    { method: firstCode, amount: round2(total) },
  ]);
  const [parcels, setParcels] = useState(2);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(30);

  const paid = round2(lines.reduce((a, l) => a + (l.amount || 0), 0));
  const remaining = round2(total - paid);
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
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(aPrazoTotal - acc) : base;
      acc = round2(acc + amount);
      // Cria data em horário LOCAL para evitar deslocamento de 1 dia (UTC-3).
      const d = new Date(firstDueDate);
      d.setDate(d.getDate() + i * intervalDays);
      parts.push({ dueDate: localDateStr(d), amount });
    }
    return parts;
  }

  function isWeekend(dateStr: string) {
    const day = new Date(dateStr + 'T00:00:00').getDay();
    return day === 0 || day === 6;
  }

  const installments = aPrazoTotal > 0 && firstDueValid ? genInstallments() : undefined;
  const weekendParcelas = installments?.filter((p) => isWeekend(p.dueDate)) ?? [];
  const balanced = Math.abs(remaining) < 0.01;
  // Basta existir UMA linha com método A_PRAZO para exigir cliente cadastrado.
  const hasAPrazoLine = lines.some((l) => l.method === 'A_PRAZO');
  const aPrazoOk = !hasAPrazoLine || (hasClient && parcels >= 1 && firstDueValid);
  const canConfirm = balanced && aPrazoOk && lines.every((l) => l.amount > 0);

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Pagamento</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-500">Total da venda</span>
          <span className="text-xl font-bold">{brl(total)}</span>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className="h-10 flex-1 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-brand-400"
                value={l.method}
                onChange={(e) =>
                  setLines((prev) => prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))
                }
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                value={l.amount || ''}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) || 0 } : x)),
                  )
                }
                className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-brand-400"
                placeholder="0,00"
              />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <button
            className="text-sm font-medium text-brand-700 hover:underline"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                { method: firstCode, amount: remaining > 0 ? remaining : 0 },
              ])
            }
          >
            + Adicionar forma
          </button>
          <span className={`text-sm font-semibold ${balanced ? 'text-emerald-600' : 'text-rose-600'}`}>
            {balanced ? 'Pago integralmente' : remaining > 0 ? `Falta ${brl(remaining)}` : `Excede ${brl(-remaining)}`}
          </span>
        </div>

        {/* Parcelamento da parte a prazo */}
        {aPrazoTotal > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="mb-2 text-sm font-semibold text-amber-700">
              A prazo: {brl(aPrazoTotal)}
            </div>
            {!hasClient && (
              <div className="mb-2 text-xs font-medium text-rose-600">
                Selecione um cliente no carrinho para vender a prazo.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 overflow-hidden text-sm sm:grid-cols-3">
              <label>
                <span className="mb-1 block text-xs text-slate-500">Parcelas</span>
                <input
                  type="number"
                  min="1"
                  value={parcels}
                  onChange={(e) => setParcels(Number(e.target.value) || 1)}
                  className="input h-9"
                />
              </label>
              <label className="col-span-2 min-w-0 sm:col-span-1">
                <span className="mb-1 block text-xs text-slate-500">1º vencimento *</span>
                <input
                  type="date"
                  value={firstDue}
                  onChange={(e) => setFirstDue(e.target.value)}
                  className={`input h-9 w-full min-w-0 ${!firstDueValid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20' : ''}`}
                />
                {!firstDueValid && (
                  <span className="mt-0.5 block text-xs font-medium text-rose-600">Informe a data</span>
                )}
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500">Intervalo (dias)</span>
                <input
                  type="number"
                  min="1"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value) || 30)}
                  className="input h-9"
                />
              </label>
            </div>
            {installments && (
              <>
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {installments.map((p, i) => {
                    const wknd = isWeekend(p.dueDate);
                    return (
                      <li key={i} className={`flex justify-between rounded px-1 ${wknd ? 'bg-amber-50 text-amber-700' : ''}`}>
                        <span>
                          {i + 1}ª · {new Date(p.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {wknd && ' ⚠️ fim de semana'}
                        </span>
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

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(lines.filter((l) => l.amount > 0), installments)}
          >
            Confirmar venda
          </button>
        </div>
      </div>
    </div>
  );
}

/** Seletor de cliente da venda: busca cadastrados ou cria um novo rapidamente. */
function ClientPicker({
  client,
  onChange,
  onToast,
}: {
  client: { id: string; name: string } | null;
  onChange: (c: { id: string; name: string } | null) => void;
  onToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ['pdv-clients', term],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string; document: string | null }> }>(
        `/api/persons?type=CLIENT&pageSize=20${term.trim() ? `&search=${encodeURIComponent(term.trim())}` : ''}`,
      ),
    enabled: open,
  });

  async function createQuick() {
    const name = term.trim();
    if (name.length < 2) return;
    setCreating(true);
    try {
      const created = await api.post<{ id: string; name: string }>('/api/persons', {
        type: 'CLIENT',
        name,
      });
      onChange({ id: created.id, name: created.name });
      onToast(`Cliente ${created.name} cadastrado`);
      setOpen(false);
      setTerm('');
    } catch {
      onToast('Falha ao cadastrar cliente');
    } finally {
      setCreating(false);
    }
  }

  if (client) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-1.5 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-brand-700">
          <User className="h-4 w-4" /> {client.name}
        </span>
        <button className="text-brand-400 hover:text-rose-500" onClick={() => onChange(null)} title="Remover">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <User className="h-4 w-4" /> Cliente: <span className="font-medium">Balcão</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-elevated">
          <input
            className="input h-9 text-sm"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar ou digitar novo cliente..."
            autoFocus
          />
          <div className="mt-1 max-h-44 overflow-auto">
            {data?.items.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange({ id: c.id, name: c.name });
                  setOpen(false);
                  setTerm('');
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {c.name}
                {c.document && <span className="ml-1 text-xs text-slate-400">{c.document}</span>}
              </button>
            ))}
            {term.trim().length >= 2 && !data?.items.some((c) => c.name.toLowerCase() === term.trim().toLowerCase()) && (
              <button
                onClick={() => void createQuick()}
                disabled={creating}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                + Cadastrar “{term.trim()}”
              </button>
            )}
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

function UnitPriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(() => (value !== 0 ? String(value) : ''));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(value !== 0 ? String(value) : '');
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/^0+(?=\d)/, '');
        setRaw(cleaned);
        skipSync.current = true;
        onChange(parseFloat(cleaned) || 0);
      }}
      onFocus={(e) => e.target.select()}
      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-medium outline-none focus:border-brand-400"
      title="Valor unitário"
    />
  );
}
