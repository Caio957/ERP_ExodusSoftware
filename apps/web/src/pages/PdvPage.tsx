import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { type PaymentType, type SalesSettings, DEFAULT_PAYMENT_TYPES } from '@exodus/shared';
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
  X,
  CheckCircle2,
  Lock,
  Package,
  User,
  Layers,
  Trash,
  ChevronDown,
  ScanBarcode,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { lookupByBarcode } from '../lib/products';
import { enqueueSale } from '../lib/sync';
import { SaleReceipt, type CompanyInfo, type SaleReceiptData } from '../components/SaleReceipt';
import { ChangeCalculatorModal } from '../components/ChangeCalculatorModal';

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
    code: number;
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
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [changeConfig, setChangeConfig] = useState<{ amount: number; onConfirm: () => void } | null>(null);
  const [confirmMethod, setConfirmMethod] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{
    items: SaleReceiptData['items'];
    total: number;
    payments: { method: string; amount: number }[];
    subtotal: number;
    discount: number;
    surcharge: number;
    clientName: string | null;
    soldAt: Date;
    code: number;
    notes: string | null;
  } | null>(null);
  const [printMode, setPrintMode] = useState<'thermal' | 'a4' | null>(null);
  const [receiptHeight, setReceiptHeight] = useState<number>(0);
  const receiptRef = useRef<HTMLDivElement>(null);

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

  const { data: company } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => api.get<CompanyInfo>('/api/settings/company'),
  });

  // Cliente padrão configurado em Configurações → Vendas (substitui o antigo
  // fallback hardcoded "Balcão"). Pré-seleciona o cliente atual do PDV.
  const { data: salesSettings } = useQuery({
    queryKey: ['settings', 'sales'],
    queryFn: () =>
      api.get<SalesSettings & { defaultPerson: { id: string; name: string; tradeName: string | null } | null }>(
        '/api/settings/sales',
      ),
  });
  const defaultClient = salesSettings?.defaultPerson
    ? { id: salesSettings.defaultPerson.id, name: salesSettings.defaultPerson.name }
    : null;
  const appliedDefaultClient = useRef(false);
  useEffect(() => {
    if (!appliedDefaultClient.current && defaultClient && !client) {
      setClient(defaultClient);
      appliedDefaultClient.current = true;
    }
  }, [defaultClient, client]);

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

  // Trava de navegação: carrinho com item pendente não pode ser perdido por
  // acidente. `resetSale()` já zera o carrinho após finalizar a venda, então
  // isso nunca bloqueia a navegação pós-venda.
  const hasUnsavedChanges = cart.length > 0;

  // Refresh / fechar aba / digitar outra URL — prompt nativo do navegador.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Navegação interna (menu lateral, bottom nav, drawer): este projeto usa
  // <BrowserRouter> "clássico" (App.tsx), não createBrowserRouter/RouterProvider
  // — o hook useBlocker do react-router-dom só funciona com um "data router"
  // e lançaria em runtime ("useBlocker must be used within a data router").
  // Migrar o roteamento do app inteiro para desbloquear um hook está fora do
  // escopo desta trava, então interceptamos o clique nos links de navegação
  // (todos renderizados como <a href> pelo <NavLink> em Layout.tsx) em fase de
  // captura do document — chega antes do handler de clique do próprio React
  // Router, então cancelar o evento aqui impede a navegação.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.getAttribute('target') === '_blank') return;
      if (href === window.location.pathname) return;
      const confirmed = window.confirm(
        'Você tem uma venda em andamento. Tem certeza que deseja sair e perder os dados?',
      );
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges]);

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
    setClient(defaultClient);
  }

  function handlePrint(mode: 'thermal' | 'a4') {
    setPrintMode(mode);
    const afterPrint = () => {
      setPrintMode(null);
      setReceiptHeight(0);
      window.removeEventListener('afterprint', afterPrint);
    };
    window.addEventListener('afterprint', afterPrint);

    // Timeout 1: aguarda o React renderizar o DOM fora da tela para medir
    window.setTimeout(() => {
      if (mode === 'thermal' && receiptRef.current) {
        // scrollHeight captura a altura total real (mesmo com collapsing
        // margins); +15px de sobra cirúrgica para a guilhotina não cortar
        // a última linha.
        setReceiptHeight(receiptRef.current.scrollHeight + 15);
      }
      // Timeout 2: aguarda o estado de altura atualizar o <style> antes de imprimir
      window.setTimeout(() => window.print(), 50);
    }, 50);
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

    const basePayload = {
      cashRegisterId: register.id,
      paymentMethod: payments[0]!.method,
      payments,
      installments: installments?.map((i) => ({ dueDate: new Date(i.dueDate), amount: i.amount })),
      items,
      clientId: client?.id,
      discount: round2(discount),
      surcharge: round2(surcharge),
      notes: notes.trim() || undefined,
    };

    // Offline-first: enfileira garantindo idempotência via clientRef (Requisito 4.4).
    const queued = await enqueueSale(basePayload);

    // Se online, chama POST /api/sales com o mesmo clientRef para obter o code sequencial.
    // O sync posterior detectará DUPLICATE e não criará duplicata.
    let saleCode = 0;
    try {
      if (navigator.onLine) {
        const created = await api.post<{ code: number }>('/api/sales', {
          ...basePayload,
          clientRef: queued.clientRef,
        });
        saleCode = created.code ?? 0;
      }
    } catch {
      // offline ou erro transitório: code permanece 0
    }

    setLastSale({
      items: cart.map((c) => ({
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
      })),
      total,
      payments,
      subtotal,
      discount: round2(discount),
      surcharge: round2(surcharge),
      clientName: client?.name ?? null,
      soldAt: new Date(),
      code: saleCode,
      notes: notes.trim() || null,
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

  // Recibo normalizado (mesma forma usada pela consulta de Vendas) — reaproveitado
  // no preview on-screen e nos dois portais off-screen de impressão (bobina/A4).
  const receiptData: SaleReceiptData | null = lastSale
    ? {
        code: lastSale.code,
        soldAt: lastSale.soldAt,
        clientName: lastSale.clientName,
        items: lastSale.items,
        subtotal: lastSale.subtotal,
        discount: lastSale.discount,
        surcharge: lastSale.surcharge,
        total: lastSale.total,
        payments: lastSale.payments,
        notes: lastSale.notes,
      }
    : null;

  return (
    <>
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:items-start print:hidden">
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
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <ScanBarcode className="h-6 w-6" />
          </span>
          <div>
            <h1 className="page-title">Ponto de venda</h1>
            <p className="text-sm text-slate-500">Escaneie um código de barras ou busque o produto.</p>
          </div>
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

        <div className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:max-h-none lg:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                <span className="text-xs font-bold tracking-wider text-slate-400 mb-2 inline-block">#{p.code}</span>
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
                  onClick={() =>
                    opt.code === 'CASH'
                      ? setChangeConfig({ amount: total, onConfirm: () => { setChangeConfig(null); void finalize('CASH'); } })
                      : setConfirmMethod(opt.code)
                  }
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
      {confirmMethod && createPortal(
        <div className="modal-overlay">
          <div className="modal-sheet w-full sm:max-w-sm flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
            <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-display text-lg font-bold">Confirmar venda?</h3>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setConfirmMethod(null)}>
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-slate-500">
                Revise os dados antes de finalizar.
              </p>
              <div className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-sm">
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
            </div>

            <footer className="shrink-0 flex gap-2 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
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
            </footer>
          </div>
        </div>,
        document.body,
      )}

      {showPayment && (
        <PaymentModal
          total={total}
          hasClient={!!client}
          clientName={client?.name ?? null}
          types={paymentTypes}
          onClose={() => setShowPayment(false)}
          onConfirm={(payments, installments) => {
            setShowPayment(false);
            const cashLine = payments.find((p) => p.method === 'CASH');
            if (cashLine) {
              setChangeConfig({
                amount: cashLine.amount,
                onConfirm: () => { setChangeConfig(null); void doSale(payments, installments); },
              });
            } else {
              void doSale(payments, installments);
            }
          }}
          onRequestSelectClient={() => setShowClientSearch(true)}
        />
      )}

      {showClientSearch && (
        <ClientSearchOverlay
          onSelect={(c) => { setClient(c); setShowClientSearch(false); }}
          onClose={() => setShowClientSearch(false)}
        />
      )}

      {changeConfig && (
        <ChangeCalculatorModal
          total={changeConfig.amount}
          onClose={() => setChangeConfig(null)}
          onConfirm={changeConfig.onConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-elevated animate-slide-up md:bottom-6">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* Modal de recibo pós-venda — print:hidden evita duplicar o recibo
          on-screen junto com a instância off-screen medida pelo Dynamic
          Measurement Engine (ambos renderizam <SaleReceipt>, classe .print-area). */}
      {lastSale && createPortal(
        <div className="modal-overlay print:hidden">
          <div className="modal-sheet w-full sm:max-w-sm flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
            <header className="shrink-0 relative flex flex-col items-center border-b border-slate-200 bg-slate-50/50 p-4 text-center">
              <button
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-700"
                onClick={() => setLastSale(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-2 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold">Venda concluída!</h3>
              <p className="text-sm text-slate-500">{brl(lastSale.total)} registrados</p>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {receiptData && <SaleReceipt company={company ?? {}} sale={receiptData} format="thermal" />}
            </div>

            <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
              {/* Botões travados enquanto uma impressão está em curso
                  (`printMode !== null`) — a janela assíncrona de medição +
                  window.print() (dois timeouts de 50ms) permitia cliques
                  repetidos que engasgam o navegador do celular. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-primary flex items-center justify-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={printMode !== null}
                  onClick={() => handlePrint('thermal')}
                >
                  🖨️ Bobina (80mm)
                </button>
                <button
                  className="btn-primary flex items-center justify-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={printMode !== null}
                  onClick={() => handlePrint('a4')}
                >
                  📄 Imprimir / Salvar PDF (A4)
                </button>
              </div>
              <button
                className="btn-ghost flex w-full items-center justify-center gap-2"
                onClick={() => setLastSale(null)}
              >
                <X className="h-4 w-4" /> Fechar
              </button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </div>

    {printMode && (
      <style>{printMode === 'thermal'
        ? `
    @page { margin: 0; size: 80mm ${receiptHeight > 0 ? receiptHeight + 'px' : 'auto'}; }
    @media print {
      body > *:not(#thermal-print-root) { display: none !important; }
      #thermal-print-root { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; }
      body { margin: 0; padding: 0; background: white; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `
        : `
    @page { margin: 10mm; size: A4 portrait; }
    @media print {
      body > *:not(#a4-print-root) { display: none !important; }
      #a4-print-root { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; }
      body { margin: 0; padding: 0; background: white; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `
      }</style>
    )}

    {receiptData && printMode === 'thermal' && createPortal(
      <div id="thermal-print-root" className="fixed top-[-9999px] left-[-9999px] w-full bg-white text-black">
        <div ref={receiptRef} className="mx-auto flex w-full justify-center">
          <SaleReceipt company={company ?? {}} sale={receiptData} format="thermal" />
        </div>
      </div>,
      document.body,
    )}

    {receiptData && printMode === 'a4' && createPortal(
      // Largura fixa de 210mm (não `w-full`): no celular, `w-full` = largura do
      // viewport (~360px) esmagava a folha A4 (o `maxWidth:100%` do template
      // clampava a 210mm para a largura do celular), e o `@page A4` depois
      // escalava esse layout esmagado — cupom quebrado. Ancorar em 210mm torna
      // a renderização off-screen imune ao viewport.
      <div id="a4-print-root" className="fixed top-[-9999px] left-[-9999px] w-[210mm] bg-white text-black">
        <div className="w-full max-w-[210mm] mx-auto bg-white">
          <SaleReceipt company={company ?? {}} sale={receiptData} format="a4" />
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}

/** Modal de pagamento: múltiplas formas (split) + parcelamento "A prazo". */
function PaymentModal({
  total,
  hasClient,
  clientName,
  types,
  onClose,
  onConfirm,
  onRequestSelectClient,
}: {
  total: number;
  hasClient: boolean;
  clientName: string | null;
  types: PaymentType[];
  onClose: () => void;
  onConfirm: (
    payments: { method: string; amount: number }[],
    installments?: { dueDate: string; amount: number }[],
  ) => void;
  onRequestSelectClient: () => void;
}) {
  const firstCode = types[0]?.code ?? 'CASH';
  const [lines, setLines] = useState<{ method: string; amount: number }[]>([
    { method: firstCode, amount: round2(total) },
  ]);
  const [parcels, setParcels] = useState(2);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [conditionStr, setConditionStr] = useState('30');
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

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
          // Parcela dentro dos intervalos declarados: DataDaVenda + intervals[i] dias.
          const interval = intervals[i] ?? fallbackInterval;
          const d = new Date(firstDueDate);
          d.setDate(d.getDate() + interval);
          dueDate = localDateStr(d);
        } else {
          // Parcela extra (usuário forçou parcelas > intervalos): data anterior + último intervalo.
          const prev = parts[i - 1];
          const prevDate = prev ? new Date(prev.dueDate + 'T00:00:00') : new Date(firstDueDate);
          prevDate.setDate(prevDate.getDate() + fallbackInterval);
          dueDate = localDateStr(prevDate);
        }
      } else {
        // Intervalo único: firstDue + i * interval (comportamento anterior).
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

  const installments = aPrazoTotal > 0 && firstDueValid ? genInstallments() : undefined;
  // Aplica overrides manuais de data antes de enviar ao backend e exibir ao usuário.
  const resolvedInstallments = installments?.map((p, i) => ({
    ...p,
    dueDate: customDates[i] ?? p.dueDate,
  }));
  const weekendParcelas = resolvedInstallments?.filter((p) => isWeekend(p.dueDate)) ?? [];
  const balanced = Math.abs(remaining) < 0.01;
  // Basta existir UMA linha com método A_PRAZO para exigir cliente cadastrado.
  const hasAPrazoLine = lines.some((l) => l.method === 'A_PRAZO');
  const aPrazoOk = !hasAPrazoLine || (hasClient && parcels >= 1 && firstDueValid);
  const canConfirm = balanced && aPrazoOk && lines.every((l) => l.amount > 0);

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-md flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
          <h3 className="font-display text-lg font-bold">Pagamento</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-500">Total da venda</span>
          <span className="text-xl font-bold">{brl(total)}</span>
        </div>

        {/* Cliente vinculado à venda */}
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Cliente</p>
              <p className="text-sm font-semibold text-slate-900">{clientName ?? 'Balcão'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestSelectClient}
            className="text-sm font-semibold text-brand-600 hover:text-brand-800"
          >
            {clientName ? 'Alterar' : 'Selecionar'}
          </button>
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
                  <option
                    key={t.code}
                    value={t.code}
                    disabled={t.code !== l.method && lines.some((x, j) => j !== i && x.method === t.code)}
                  >
                    {t.label}
                  </option>
                ))}
              </select>
              <SplitAmountInput
                value={l.amount}
                onChange={(v) => {
                  setLines((prev) => {
                    const next = prev.map((x, j) => (j === i ? { ...x, amount: v } : x));
                    if (i > 0 && next[0]) {
                      const othersSum = round2(next.slice(1).reduce((a, x) => a + x.amount, 0));
                      next[0] = { ...next[0], amount: Math.max(0, round2(total - othersSum)) };
                    }
                    return next;
                  });
                }}
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
                Selecione um cliente para vender a prazo.{' '}
                <button
                  type="button"
                  onClick={onRequestSelectClient}
                  className="font-semibold underline hover:text-rose-700"
                >
                  Vincular agora
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 overflow-hidden text-sm sm:grid-cols-3">
              <label>
                <span className="mb-1 block text-xs text-slate-500">Parcelas</span>
                <IntegerInput
                  value={parcels}
                  onChange={(val) => {
                    setParcels(val);
                    setCustomDates({});
                    const parsed = conditionStr
                      .split(/[\/\-,.]/)
                      .map((n) => parseInt(n.trim(), 10))
                      .filter((n) => !isNaN(n));
                    if (parsed.length > 1) {
                      setConditionStr(String(parsed[0] ?? 30));
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
                    const parsed = val
                      .split(/[\/\-,.]/)
                      .map((n) => parseInt(n.trim(), 10))
                      .filter((n) => !isNaN(n));
                    if (parsed.length > 1) setParcels(parsed.length);
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
                            className="rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-brand-400"
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

        <footer className="shrink-0 flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!canConfirm}
            onClick={() => onConfirm(lines.filter((l) => l.amount > 0), resolvedInstallments)}
          >
            Confirmar venda
          </button>
        </footer>
      </div>
    </div>,
    document.body,
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
      <div className="flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 transition-colors hover:border-brand-400 hover:bg-brand-100">
        <div className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-brand-600" />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="truncate text-sm font-semibold text-slate-900">{client.name}</p>
          </div>
        </div>
        <button
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50 transition-colors"
          onClick={() => onChange(null)}
          title="Remover cliente"
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-brand-400 hover:bg-slate-100"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="text-left">
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="text-sm font-semibold text-slate-900">Balcão</p>
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-500" />
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
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');

  const [rawAmount, setRawAmount] = useState(() => toRaw(amount));
  const skipAmount = useRef(false);
  useEffect(() => {
    if (skipAmount.current) { skipAmount.current = false; return; }
    setRawAmount(toRaw(amount));
  }, [amount]);

  const [rawPct, setRawPct] = useState(() => toRaw(pct));
  const skipPct = useRef(false);
  useEffect(() => {
    if (skipPct.current) { skipPct.current = false; return; }
    setRawPct(toRaw(pct));
  }, [pct]);

  const color = tone === 'rose' ? 'text-rose-600' : 'text-emerald-600';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`font-medium ${color}`}>{label}</span>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
          <span className="text-xs text-slate-400">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={rawAmount}
            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
            onChange={(e) => {
              const cleaned = sanitizeBr(e.target.value);
              setRawAmount(cleaned);
              skipAmount.current = true;
              onAmount(Math.max(0, parseFloat(cleaned.replace(',', '.')) || 0));
            }}
            onFocus={(e) => e.target.select()}
            className="w-16 py-1 text-right outline-none"
            placeholder="0,00"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-2">
          <input
            type="text"
            inputMode="decimal"
            value={rawPct}
            onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
            onChange={(e) => {
              const cleaned = sanitizeBr(e.target.value);
              setRawPct(cleaned);
              skipPct.current = true;
              onPct(Math.max(0, parseFloat(cleaned.replace(',', '.')) || 0));
            }}
            onFocus={(e) => e.target.select()}
            className="w-12 py-1 text-right outline-none"
            placeholder="0"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>
    </div>
  );
}

function sanitizeBr(s: string): string {
  let v = s.replace(/\./g, ',');
  v = v.replace(/[^\d,]/g, '');
  v = v.replace(/^,/, '');
  const parts = v.split(',');
  if (parts.length > 1) v = parts[0] + ',' + parts.slice(1).join('');
  return v.replace(/^0+(?=\d)/, '');
}

function UnitPriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      value={raw}
      onChange={(e) => {
        const cleaned = sanitizeBr(e.target.value);
        setRaw(cleaned);
        skipSync.current = true;
        onChange(parseFloat(cleaned.replace(',', '.')) || 0);
      }}
      onFocus={(e) => e.target.select()}
      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-medium outline-none focus:border-brand-400"
      title="Valor unitário"
    />
  );
}

function SplitAmountInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      value={raw}
      onChange={(e) => {
        const cleaned = sanitizeBr(e.target.value);
        setRaw(cleaned);
        skipSync.current = true;
        onChange(Math.max(0, parseFloat(cleaned.replace(',', '.')) || 0));
      }}
      onFocus={(e) => e.target.select()}
      className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-brand-400"
      placeholder="0,00"
    />
  );
}

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

/** Overlay de busca de cliente sobreposto ao PaymentModal (z-index superior). */
function ClientSearchOverlay({
  onSelect,
  onClose,
}: {
  onSelect: (c: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['client-search-overlay', term],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string; document: string | null }> }>(
        `/api/persons?type=CLIENT&pageSize=20${term.trim() ? `&search=${encodeURIComponent(term.trim())}` : ''}`,
      ),
  });

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 60 }}>
      <div className="modal-sheet w-full sm:max-w-sm flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
          <h3 className="font-display font-bold">Selecionar cliente</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          <input
            className="input h-10 text-sm"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar cliente..."
            autoFocus
          />
          <div className="max-h-60 overflow-auto">
            {data?.items.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect({ id: c.id, name: c.name })}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {c.name}
                {c.document && <span className="ml-1 text-xs text-slate-400">{c.document}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
