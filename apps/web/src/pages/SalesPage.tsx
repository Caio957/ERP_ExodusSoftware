import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Pencil,
  Trash2,
  X,
  Plus,
  Minus,
  Search,
  AlertTriangle,
  ShieldAlert,
  Eye,
  Printer,
  Ban,
  CircleDollarSign,
} from 'lucide-react';
import type { SalesSettings } from '@exodus/shared';
import { api, ApiError } from '../lib/api';
import {
  SaleReceipt,
  printReceipt,
  type ReceiptFormat,
  type CompanyInfo,
  type SaleReceiptData,
} from '../components/SaleReceipt';
import { ChangeCalculatorModal } from '../components/ChangeCalculatorModal';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const methodLabel: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  A_PRAZO: 'A prazo',
  SPLIT: 'Múltiplas formas',
};

// Formas à vista oferecidas na edição (split não é reaberto aqui).
const SINGLE_METHODS = ['CASH', 'PIX', 'DEBIT', 'CREDIT'] as const;

interface SaleListItem {
  id: string;
  code: number;
  soldAt: string;
  paymentMethod: string;
  totalAmount: number;
  financialGenerated: boolean;
  client: { name: string } | null;
  items: Array<{ id: string }>;
}

interface SaleDetail {
  id: string;
  code: number;
  soldAt: string;
  paymentMethod: string;
  financialGenerated: boolean;
  subtotal: number;
  discount: number;
  surcharge: number;
  totalAmount: number;
  notes: string | null;
  clientId: string | null;
  client: { id: string; name: string } | null;
  items: Array<{
    variantId: string;
    quantity: number;
    unitPrice: number;
    variant: { description: string; product: { name: string } };
  }>;
  payments: Array<{ method: string; amount: number }>;
  financialAccounts: Array<{ id: string; description: string; amount: number; dueDate: string; status: string }>;
}

export function SalesPage() {
  const qc = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get<{ items: SaleListItem[] }>('/api/sales?pageSize=100'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sales'] });
    qc.invalidateQueries({ queryKey: ['cash-current'] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/sales/${id}`),
    onSuccess: invalidate,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  function handleDelete(s: SaleListItem) {
    if (
      window.confirm(
        `Excluir a venda #${s.code} de ${brl(s.totalAmount)}?\nO estoque será estornado e o financeiro vinculado removido.`,
      )
    ) {
      remove.mutate(s.id);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
          <Receipt className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Vendas</h1>
          <p className="text-sm text-slate-500">Consulte, visualize, edite ou exclua as vendas registradas.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-2">NºDOC</th>
                <th>Data</th>
                <th>Pagamento</th>
                <th>Cliente</th>
                <th className="text-center">Itens</th>
                <th className="text-right">Total</th>
                <th>Financeiro</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 font-semibold text-slate-500">#{s.code}</td>
                  <td>{new Date(s.soldAt).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className="badge-neutral">{methodLabel[s.paymentMethod] ?? s.paymentMethod}</span>
                  </td>
                  <td className="text-slate-500">{s.client?.name ?? 'Balcão'}</td>
                  <td className="text-center">{s.items.length}</td>
                  <td className="text-right font-semibold">{brl(s.totalAmount)}</td>
                  <td>
                    <FinancialBadge generated={s.financialGenerated} />
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                        onClick={() => setViewingId(s.id)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
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
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Receipt className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                    Nenhuma venda registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewingId && (
        <ViewSaleModal
          saleId={viewingId}
          onClose={() => setViewingId(null)}
          onEdit={(id) => {
            setViewingId(null);
            setEditingId(id);
          }}
          onPrint={(id) => setPrintingId(id)}
          onChanged={invalidate}
        />
      )}

      {editingId && (
        <EditSaleModal
          saleId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            invalidate();
          }}
        />
      )}

      {printingId && <PrintSaleModal saleId={printingId} onClose={() => setPrintingId(null)} />}
    </div>
  );
}

function FinancialBadge({ generated }: { generated: boolean }) {
  return generated ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Com financeiro
    </span>
  ) : (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
      Sem financeiro
    </span>
  );
}

// ---------------------------------------------------------------------------
// Visualização da venda (somente leitura) — decide se vai editar/imprimir.
// ---------------------------------------------------------------------------
function ViewSaleModal({
  saleId,
  onClose,
  onEdit,
  onPrint,
  onChanged,
}: {
  saleId: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onPrint: (id: string) => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api.get<SaleDetail>(`/api/sales/${saleId}`),
  });

  const toggleFinancial = useMutation({
    mutationFn: (generated: boolean) =>
      generated ? api.post(`/api/sales/${saleId}/financial`, {}) : api.del(`/api/sales/${saleId}/financial`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sale', saleId] });
      onChanged();
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao alterar o financeiro'),
  });

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full max-w-2xl flex flex-col overflow-hidden !p-0">
        <header className="shrink-0 p-4 border-b border-slate-200 flex justify-between items-start bg-slate-50/50">
          <div>
            <h2 className="font-display text-lg font-bold">Venda {sale ? `#${sale.code}` : ''}</h2>
            {sale && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{new Date(sale.soldAt).toLocaleString('pt-BR')}</span>
                <FinancialBadge generated={sale.financialGenerated} />
              </div>
            )}
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {isLoading || !sale ? (
            <div className="grid h-32 place-items-center text-slate-500">Carregando...</div>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-slate-400">Cliente:</span> {sale.client?.name ?? 'Balcão'}
              </div>

              <ul className="divide-y divide-slate-100 text-sm">
                {sale.items.map((it, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>
                      {it.variant.product.name} — {it.variant.description}
                    </span>
                    <span className="text-slate-500">
                      {it.quantity} × {brl(it.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-1 border-t border-slate-100 pt-2 text-sm">
                <Row label="Subtotal" value={brl(sale.subtotal)} />
                {sale.discount > 0 && <Row label="Desconto" value={`- ${brl(sale.discount)}`} tone="rose" />}
                {sale.surcharge > 0 && <Row label="Acréscimo" value={`+ ${brl(sale.surcharge)}`} tone="emerald" />}
                <div className="flex justify-between pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>{brl(sale.totalAmount)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="mb-1 font-semibold">Pagamento</div>
                {(sale.payments.length ? sale.payments : [{ method: sale.paymentMethod, amount: sale.totalAmount }]).map(
                  (p, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{methodLabel[p.method] ?? p.method}</span>
                      <span>{brl(p.amount)}</span>
                    </div>
                  ),
                )}
              </div>

              {sale.financialAccounts.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="mb-1 font-semibold">Contas a receber (a prazo)</div>
                  {sale.financialAccounts.map((a) => (
                    <div key={a.id} className="flex justify-between text-slate-600">
                      <span>
                        {new Date(a.dueDate).toLocaleDateString('pt-BR')} · {a.status}
                      </span>
                      <span>{brl(a.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {sale.notes && <p className="text-sm text-slate-500">Obs.: {sale.notes}</p>}
            </>
          )}
        </div>

        {sale && (
          <footer className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap justify-end gap-3">
            <button className="btn-ghost" onClick={() => onPrint(sale.id)}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            {sale.financialGenerated ? (
              <button
                className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                disabled={toggleFinancial.isPending}
                onClick={() => {
                  if (window.confirm('Excluir o financeiro desta venda? Ela deixará de contar no caixa/recebimentos.'))
                    toggleFinancial.mutate(false);
                }}
              >
                <Ban className="h-4 w-4" /> Excluir financeiro
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                disabled={toggleFinancial.isPending}
                onClick={() => toggleFinancial.mutate(true)}
              >
                <CircleDollarSign className="h-4 w-4" /> Gerar financeiro
              </button>
            )}
            <button
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sale.financialGenerated}
              title={sale.financialGenerated ? 'Exclua o financeiro antes de editar' : 'Editar venda'}
              onClick={() => onEdit(sale.id)}
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'rose' | 'emerald' }) {
  const c = tone === 'rose' ? 'text-rose-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-slate-500';
  return (
    <div className="flex justify-between">
      <span className={c}>{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impressão (escolha do formato: cupom térmico ou folha A4).
// ---------------------------------------------------------------------------
function PrintSaleModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [format, setFormat] = useState<ReceiptFormat>('thermal');
  const { data: sale } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api.get<SaleDetail>(`/api/sales/${saleId}`),
  });
  const { data: company } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => api.get<CompanyInfo>('/api/settings/company'),
  });

  if (!sale) return null;

  const receipt: SaleReceiptData = {
    code: sale.code,
    soldAt: sale.soldAt,
    clientName: sale.client?.name ?? null,
    items: sale.items.map((it) => ({
      description: `${it.variant.product.name} - ${it.variant.description}`,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    surcharge: sale.surcharge,
    total: sale.totalAmount,
    payments: sale.payments.length ? sale.payments : [{ method: sale.paymentMethod, amount: sale.totalAmount }],
  };

  return createPortal(
    <div className="modal-overlay print:bg-white print:p-0">
      <div className="flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:max-h-[90vh] sm:max-w-3xl sm:animate-scale-in sm:rounded-2xl print:max-h-none print:shadow-none">
        <div className="border-b border-slate-100 p-4 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Imprimir comprovante</h2>
            <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex flex-1 rounded-xl bg-slate-100 p-1">
              <button
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${format === 'thermal' ? 'bg-white shadow-soft' : 'text-slate-500'}`}
                onClick={() => setFormat('thermal')}
              >
                Cupom térmico
              </button>
              <button
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${format === 'a4' ? 'bg-white shadow-soft' : 'text-slate-500'}`}
                onClick={() => setFormat('a4')}
              >
                Folha A4
              </button>
            </div>
            <button className="btn-primary shrink-0" onClick={() => printReceipt()}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
        </div>
        <div className="overflow-auto bg-slate-100 p-6 print:overflow-visible print:bg-white print:p-0">
          <SaleReceipt company={company ?? {}} sale={receipt} format={format} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Edição da venda (itens, desconto/acréscimo, cliente, pagamento à vista ou
// a prazo). O backend estorna o estoque, refaz o financeiro e regrava tudo.
// ---------------------------------------------------------------------------
interface EditItem {
  variantId: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function genInstallments(total: number, n: number, firstDue: string, intervalDays: number) {
  // T00:00:00 → interpreta como horário LOCAL, evita shift de fuso (UTC-3)
  const base0 = firstDue.trim() ? new Date(firstDue + 'T00:00:00') : null;
  if (!base0 || isNaN(base0.getTime())) return [];
  const count = Math.max(1, Math.floor(n));
  const base = Math.floor((total / count) * 100) / 100;
  const parts: { dueDate: string; amount: number }[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? round2(total - acc) : base;
    acc = round2(acc + amount);
    const d = new Date(base0);
    d.setDate(d.getDate() + i * intervalDays);
    parts.push({ dueDate: localDateStr(d), amount });
  }
  return parts;
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
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [changeConfig, setChangeConfig] = useState<{ amount: number; onConfirm: () => void } | null>(null);
  // Parcelas (quando a prazo).
  const [parcels, setParcels] = useState(1);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(30);
  const [localError, setLocalError] = useState<string | null>(null);

  // Cliente padrão configurado em Configurações → Vendas — usado como
  // fallback no lugar do antigo "Balcão" quando nenhum cliente é selecionado.
  const { data: salesSettings } = useQuery({
    queryKey: ['settings', 'sales'],
    queryFn: () =>
      api.get<SalesSettings & { defaultPerson: { id: string; name: string; tradeName: string | null } | null }>(
        '/api/settings/sales',
      ),
  });

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api.get<SaleDetail>(`/api/sales/${saleId}`),
  });

  // Sincroniza o estado local do "mini-PDV" com os dados da venda assim que
  // chegam. Guardado por items.length === 0 para inicializar só uma vez —
  // evita sobrescrever edições do usuário caso a query seja invalidada/
  // refeita (ex.: cache compartilhado com o ViewSaleModal, que usa a mesma
  // queryKey com um queryFn diferente, sem efeitos colaterais).
  useEffect(() => {
    if (!sale || items.length > 0) return;
    setItems(
      sale.items.map((it) => ({
        variantId: it.variantId,
        description: `${it.variant.product.name} - ${it.variant.description}`,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
      })),
    );
    // Mantém a prazo se a venda era a prazo; senão normaliza para forma única.
    const isAprazo = sale.paymentMethod === 'A_PRAZO' || sale.payments.some((p) => p.method === 'A_PRAZO');
    setPaymentMethod(isAprazo ? 'A_PRAZO' : (SINGLE_METHODS as readonly string[]).includes(sale.paymentMethod) ? sale.paymentMethod : 'CASH');
    setDiscount(sale.discount);
    setSurcharge(sale.surcharge);
    setNotes(sale.notes ?? '');
    setClient(sale.client ? { id: sale.client.id, name: sale.client.name } : null);
  }, [sale]);

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
  const isAprazo = paymentMethod === 'A_PRAZO';

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
        // Sem cliente selecionado: usa o cliente padrão configurado em vez
        // de deixar a venda sem pessoa vinculada ("Balcão" hardcoded).
        clientId: client?.id ?? salesSettings?.defaultPersonId ?? undefined,
        items: items.map((it) => ({ variantId: it.variantId, quantity: it.quantity, unitPrice: it.unitPrice })),
        discount: round2(discount),
        surcharge: round2(surcharge),
        notes: notes.trim() || undefined,
        ...(isAprazo
          ? {
              payments: [{ method: 'A_PRAZO', amount: total }],
              installments: genInstallments(total, parcels, firstDue, intervalDays),
            }
          : {}),
      }),
    onSuccess: onSaved,
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  function executeSave() {
    setLocalError(null);
    if (items.length === 0) return setLocalError('A venda precisa de ao menos um item.');
    if (isAprazo && !client) return setLocalError('Venda a prazo exige um cliente.');
    save.mutate();
  }

  // Intercepta o clique em "Salvar alterações": se o pagamento for em
  // dinheiro, abre a calculadora de troco (mesmo fluxo maduro do PDV) antes
  // de disparar a API; caso contrário, pede confirmação padrão.
  function handleSaveClick() {
    if (items.length === 0) {
      setLocalError('A venda precisa de ao menos um item.');
      return;
    }
    if (paymentMethod === 'CASH') {
      setChangeConfig({ amount: total, onConfirm: executeSave });
      return;
    }
    if (window.confirm('Deseja realmente salvar as alterações desta venda?')) {
      executeSave();
    }
  }

  // Guarda de segurança: bloqueia a edição se a venda ainda tiver financeiro
  // gerado (o operador deve excluir o financeiro manualmente primeiro, para
  // ter consciência do impacto no caixa/recebimentos).
  if (sale?.financialGenerated) {
    return createPortal(
      <div className="modal-overlay">
        <div className="modal-sheet w-full sm:max-w-md flex flex-col overflow-hidden !p-0">
          <header className="shrink-0 p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-display text-lg font-bold">Editar venda #{sale.code}</h2>
            <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ShieldAlert className="h-12 w-12 text-rose-500" />
              <p className="text-sm font-medium text-slate-700">
                Acesso Negado: Esta venda possui financeiro gerado. Feche, exclua o financeiro e
                tente novamente.
              </p>
            </div>
          </div>
          <footer className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button className="btn-ghost" onClick={onClose}>
              Fechar
            </button>
          </footer>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-5xl h-[90dvh] max-h-screen flex flex-col overflow-hidden !p-0">
        {/* Cabeçalho fixo */}
        <header className="shrink-0 p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="font-display text-lg font-bold">Editar venda{sale ? ` #${sale.code}` : ''}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Ao salvar, o estoque é reajustado e o financeiro vinculado é refeito.
            </p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Corpo com scroll interno */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid h-full place-items-center text-slate-500">Carregando venda...</div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* ---- Coluna esquerda: carrinho (cliente + busca + itens) ---- */}
              <div className="space-y-4 lg:col-span-2">
                <div>
                  <span className="label">Cliente</span>
                  <ClientPicker
                    value={client}
                    onChange={setClient}
                    defaultPersonName={salesSettings?.defaultPerson?.name ?? null}
                  />
                </div>

                {/* Busca de produto para adicionar à venda */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input h-11 pl-9 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar produto para adicionar à venda..."
                  />
                  {results && search.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
                      {results.items.flatMap((p) =>
                        p.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => addVariant(v, p.name)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            {p.name} — {v.description} <span className="text-brand-600">{brl(v.salePrice)}</span>
                          </button>
                        )),
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de itens (Mini-PDV) */}
                {items.length === 0 ? (
                  <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                    <Receipt className="mb-2 h-8 w-8 text-slate-300" />
                    Nenhum item na venda. Busque um produto acima para adicionar.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {items.map((it) => (
                      <li key={it.variantId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold">{it.description}</span>
                          <button
                            className="text-slate-300 transition hover:text-rose-500"
                            title="Remover item"
                            onClick={() => setItems((prev) => prev.filter((x) => x.variantId !== it.variantId))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 ring-1 ring-slate-200 transition hover:bg-slate-100"
                              onClick={() => changeQty(it.variantId, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-7 text-center font-bold">{it.quantity}</span>
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 ring-1 ring-slate-200 transition hover:bg-slate-100"
                              onClick={() => changeQty(it.variantId, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-slate-400">R$</span>
                            <EditItemPriceInput
                              value={it.unitPrice}
                              onChange={(v) => setItem(it.variantId, { unitPrice: v })}
                            />
                          </div>
                          <span className="w-24 text-right font-bold">{brl(it.unitPrice * it.quantity)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ---- Coluna direita: resumo financeiro ---- */}
              <div className="lg:col-span-1">
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-0">
                  <h3 className="font-display text-base font-bold text-slate-700">Resumo da venda</h3>

                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-700">{brl(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-rose-600">Desconto (R$)</span>
                    <FinancialAdjustInput
                      value={discount}
                      onChange={setDiscount}
                      placeholder="0,00"
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600">Acréscimo (R$)</span>
                    <FinancialAdjustInput
                      value={surcharge}
                      onChange={setSurcharge}
                      placeholder="0,00"
                      className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right outline-none"
                    />
                  </div>

                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-500">Forma de pagamento</span>
                    <select
                      className="input h-10"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      {SINGLE_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {methodLabel[m]}
                        </option>
                      ))}
                      <option value="A_PRAZO">{methodLabel.A_PRAZO}</option>
                    </select>
                  </label>

                  {/* Parcelas da venda a prazo */}
                  {isAprazo && (
                    <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                      <div className="mb-2 text-xs font-semibold text-brand-700">
                        Parcelas (geram contas a receber) — exige cliente
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block">
                          <span className="label">Parcelas</span>
                          <input
                            className="input h-9"
                            type="number"
                            min={1}
                            value={parcels}
                            onChange={(e) => setParcels(Number(e.target.value) || 1)}
                          />
                        </label>
                        <label className="block">
                          <span className="label">1º venc.</span>
                          <input
                            className="input h-9"
                            type="date"
                            value={firstDue}
                            onChange={(e) => setFirstDue(e.target.value)}
                          />
                        </label>
                        <label className="block">
                          <span className="label">Interv.</span>
                          <input
                            className="input h-9"
                            type="number"
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(Number(e.target.value) || 30)}
                          />
                        </label>
                      </div>
                      {parcels > 1 && (
                        <div className="mt-2 text-xs text-brand-700">
                          {parcels}× de aprox. <strong>{brl(round2(total / parcels))}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-500">Observação</span>
                    <input
                      className="input h-10"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observação da venda"
                      maxLength={500}
                    />
                  </label>

                  <div className="flex items-end justify-between border-t border-slate-200 pt-3">
                    <span className="text-sm font-semibold text-slate-500">Total</span>
                    <span className="font-display text-2xl font-extrabold text-slate-900">{brl(total)}</span>
                  </div>

                  {localError && (
                    <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{localError}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <footer className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={save.isPending || items.length === 0} onClick={handleSaveClick}>
            {save.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </footer>
      </div>
    </div>
    {changeConfig && (
      <ChangeCalculatorModal
        total={changeConfig.amount}
        onClose={() => setChangeConfig(null)}
        onConfirm={() => {
          setChangeConfig(null);
          changeConfig.onConfirm();
        }}
      />
    )}
    </>,
    document.body,
  );
}

// Seletor de cliente (busca em /api/persons?type=CLIENT).
function ClientPicker({
  value,
  onChange,
  defaultPersonName,
}: {
  value: { id: string; name: string } | null;
  onChange: (c: { id: string; name: string } | null) => void;
  defaultPersonName?: string | null;
}) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['edit-sale-clients', term],
    queryFn: () =>
      api.get<{ items: Array<{ id: string; name: string }> }>(
        `/api/persons?type=CLIENT&pageSize=20${term.trim() ? `&search=${encodeURIComponent(term.trim())}` : ''}`,
      ),
    enabled: !value,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <span className="font-medium">{value.name}</span>
        <button className="text-xs underline" onClick={() => onChange(null)}>
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={`Buscar cliente (Padrão: ${defaultPersonName || 'Nenhum'})...`}
      />
      {data && data.items.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
          {data.items.map((p) => (
            <button
              key={p.id}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => onChange(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
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

function EditItemPriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-brand-400"
    />
  );
}

function FinancialAdjustInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
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
      value={raw}
      placeholder={placeholder}
      className={className}
      onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
      onChange={(e) => {
        const cleaned = sanitizeBr(e.target.value);
        setRaw(cleaned);
        skipSync.current = true;
        onChange(Math.max(0, parseFloat(cleaned.replace(',', '.')) || 0));
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}
