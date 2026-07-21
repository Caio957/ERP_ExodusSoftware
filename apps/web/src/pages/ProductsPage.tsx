import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marginFromPrice,
  markupFromPrice,
  priceFromMargin,
  priceFromMarkup,
  type ProductFormSettings,
} from '@exodus/shared';
import {
  Plus,
  Search,
  Package,
  Tag,
  Pencil,
  Trash2,
  X,
  ShieldCheck,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Variant {
  id: string;
  sku: string;
  description: string;
  barcode: string | null;
  costPrice: number;
  averageCost: number;
  salePrice: number;
  stockQty: number;
  batch: string | null;
  validity: string | null;
}
interface Product {
  id: string;
  code: number;
  name: string;
  brand: string;
  group: string;
  subgroup: string | null;
  tracksLotValidity: boolean;
  variants: Variant[];
}
interface ProductList {
  items: Product[];
  total: number;
}

export function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');
  const [subgroup, setSubgroup] = useState('');
  const [orderBy, setOrderBy] = useState<'name' | 'code' | 'sku' | 'price'>('name');
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Paginação client-driven (padrão Tray, mesmo motor de Vendas/Financeiro/
  // Compras) — o backend já pagina de verdade (skip/take + total), só faltava
  // o front pedir a página certa em vez do pageSize fixo em 100.
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, brand, group, subgroup, orderBy, orderDir, currentPage, itemsPerPage],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(itemsPerPage),
        orderBy,
        orderDir,
      });
      if (search.trim()) qs.set('search', search.trim());
      if (brand.trim()) qs.set('brand', brand.trim());
      if (group.trim()) qs.set('group', group.trim());
      if (subgroup.trim()) qs.set('subgroup', subgroup.trim());
      return api.get<ProductList>(`/api/products?${qs.toString()}`);
    },
  });

  // Filtro/ordenação/tamanho de página mudou → volta pra primeira página (o
  // recorte antigo pode não existir mais).
  useEffect(() => {
    setCurrentPage(1);
  }, [search, brand, group, subgroup, orderBy, orderDir, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / itemsPerPage));

  // Rede de segurança: se totalPages encolher (novo filtro/pageSize), evita página fantasma.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  function handleDelete(p: Product) {
    if (window.confirm(`Excluir o produto "${p.name}"? Esta ação não pode ser desfeita.`)) {
      remove.mutate(p.id);
    }
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['products'] });

  return (
    <div className="flex flex-col space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="page-title">Produtos</h1>
            <p className="text-sm text-slate-500">Catálogo, preços e estoque da loja.</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="h-5 w-5" /> Novo produto
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto, marca ou SKU..."
          />
        </div>
        <button
          className={showFilters ? 'btn-primary' : 'btn-ghost'}
          onClick={() => setShowFilters((v) => !v)}
          title="Filtros"
        >
          <Filter className="h-5 w-5" /> Filtros
        </button>
      </div>

      {showFilters && (
        <div className="card grid animate-fade-in gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <label className="block">
            <span className="label">Marca</span>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Todas" />
          </label>
          <label className="block">
            <span className="label">Grupo</span>
            <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Todos" />
          </label>
          <label className="block">
            <span className="label">Subgrupo</span>
            <input className="input" value={subgroup} onChange={(e) => setSubgroup(e.target.value)} placeholder="Todos" />
          </label>
          <label className="block">
            <span className="label">Ordenar por</span>
            <select
              className="input"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as typeof orderBy)}
            >
              <option value="name">Descrição</option>
              <option value="code">Código</option>
              <option value="sku">SKU</option>
              <option value="price">Preço de venda</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Ordem</span>
            <select
              className="input"
              value={orderDir}
              onChange={(e) => setOrderDir(e.target.value as typeof orderDir)}
            >
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((p) => (
            <div key={p.id} className="card-hover flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-neutral text-slate-400">#{p.code}</span>
                  {p.brand && <span className="badge-brand">{p.brand}</span>}
                  {p.group && <span className="badge-neutral">{p.group}</span>}
                  {p.tracksLotValidity && (
                    <span className="badge-warning" title="Controla lote e validade">
                      <ShieldCheck className="h-3.5 w-3.5" /> Lote
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
                    onClick={() => setEditing(p)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => handleDelete(p)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="font-display text-base font-bold">{p.name}</div>
              {p.subgroup && <div className="text-xs text-slate-400">{p.subgroup}</div>}
              <ul className="mt-3 space-y-1.5 text-sm">
                {p.variants.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Tag className="h-3.5 w-3.5 text-slate-400" />
                      {v.description}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {brl(v.salePrice)}
                      <span className="ml-1 font-normal text-slate-400">· {v.stockQty}un</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data?.items.length === 0 && (
            <div className="col-span-full grid place-items-center rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
              <div>
                <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="font-semibold text-slate-600">Nenhum produto encontrado</p>
                <p className="text-sm text-slate-400">Ajuste os filtros ou cadastre o primeiro produto.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
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

      {showForm && (
        <ProductForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            invalidate();
          }}
        />
      )}

      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}

// Botão flutuante "Voltar ao topo" — Dark Glassmorphism (mesmo padrão de
// RegistrationsPage.tsx/FinancialPage.tsx). Ejetado via createPortal(...,
// document.body): o `animate-fade-in` do Layout.tsx deixa um `transform`
// persistente no wrapper de rota, virando containing block e quebrando
// `position: fixed` em descendentes.
function ScrollToTopButton() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return createPortal(
    <button
      className={`fixed right-4 bottom-24 md:bottom-8 md:right-8 z-50 backdrop-blur-md transition-all duration-500 shadow-xl rounded-full p-3 flex items-center justify-center ${
        showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-12 pointer-events-none'
      }`}
      style={{ backgroundColor: hover ? 'rgba(30, 41, 59, 0.9)' : 'rgba(30, 41, 59, 0.6)', color: 'white' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Voltar ao topo"
    >
      <ArrowUp className="w-6 h-6" />
    </button>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Schemas Zod dinâmicos — obrigatoriedade condicionada às configurações da loja
// ---------------------------------------------------------------------------
function buildVariantSchema(barcodeRequired: boolean, tracksLotValidity: boolean, requireAverageCost: boolean) {
  return z.object({
    sku: z.string().min(1, 'SKU é obrigatório'),
    barcode: barcodeRequired ? z.string().min(1, 'Código de barras é obrigatório') : z.string(),
    costPrice: z.coerce.number().min(0).catch(0),
    averageCost: z.coerce.number().refine(
      (val) => !requireAverageCost || val > 0,
      { message: 'Custo médio é obrigatório' },
    ),
    salePrice: z.coerce.number().min(0).catch(0),
    batch: tracksLotValidity ? z.string().min(1, 'Lote é obrigatório') : z.string(),
    validity: tracksLotValidity ? z.string().min(1, 'Validade é obrigatória') : z.string(),
  });
}

function toFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '_');
    if (!errs[key]) errs[key] = issue.message;
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Cadastro de novo produto — multi-variante (ex.: perfume 50ml/100ml, batom
// em várias cores) numa única chamada a POST /api/products, que já aceita
// `variants: CreateVariantInput[]` (nunca precisou de mudança de backend).
// ---------------------------------------------------------------------------
interface NewVariantRow {
  key: string; // id client-side p/ React key + updates; não é enviado ao backend
  sku: string;
  barcode: string;
  description: string;
  stockQty: string;
  batch: string;
  validity: string;
  cost: number;
  averageCost: number;
  salePrice: number;
  pct: number;
}

function emptyVariantRow(): NewVariantRow {
  return {
    key: crypto.randomUUID(),
    sku: '',
    barcode: '',
    description: '',
    stockQty: '0',
    batch: '',
    validity: '',
    cost: 0,
    averageCost: 0,
    salePrice: 0,
    pct: 0,
  };
}

function ProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', brand: '', group: '', subgroup: '' });
  const [tracksLotValidity, setTracksLotValidity] = useState(false);
  const [variants, setVariants] = useState<NewVariantRow[]>(() => [emptyVariantRow()]);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, Record<string, string>>>({});

  // Config da loja: define quais campos são obrigatórios (Onda 2).
  const { data: settings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const brandRequired = settings?.brandRequired ?? false;
  const groupRequired = settings?.groupRequired ?? false;
  const subgroupRequired = settings?.subgroupRequired ?? false;
  const barcodeRequired = settings?.barcodeRequired ?? false;
  const requireAverageCost = settings?.requireAverageCost ?? false;
  // Lote/validade é sempre opt-in: todo produto novo abre desmarcado e quem
  // decide é o usuário, por produto (vale para todas as variantes dele).
  const pricingMode = settings?.pricingMode ?? 'margin';

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function updateVariant(key: string, patch: Partial<NewVariantRow>) {
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }
  // Precificação por variante: cada uma tem seu próprio custo/margem/venda —
  // mesma lógica bidirecional de sempre, só que aplicada por `key`.
  function applyVariantCost(key: string, novoCusto: number) {
    setVariants((vs) => vs.map((v) => {
      if (v.key !== key) return v;
      const safePct = pricingMode === 'margin' ? Math.min(v.pct, 99.99) : v.pct;
      const salePrice = pricingMode === 'margin'
        ? priceFromMargin(novoCusto, safePct)
        : priceFromMarkup(novoCusto, safePct);
      return { ...v, cost: novoCusto, salePrice };
    }));
  }
  function applyVariantPct(key: string, novoPct: number) {
    setVariants((vs) => vs.map((v) => {
      if (v.key !== key) return v;
      const safe = pricingMode === 'margin' ? Math.min(novoPct, 99.99) : novoPct;
      const salePrice = pricingMode === 'margin'
        ? priceFromMargin(v.cost, safe)
        : priceFromMarkup(v.cost, safe);
      return { ...v, pct: safe, salePrice };
    }));
  }
  function applyVariantSalePrice(key: string, novoSale: number) {
    setVariants((vs) => vs.map((v) => {
      if (v.key !== key) return v;
      const pct = pricingMode === 'margin'
        ? marginFromPrice(v.cost, novoSale) || 0
        : markupFromPrice(v.cost, novoSale) || 0;
      return { ...v, salePrice: novoSale, pct };
    }));
  }
  function addVariant() {
    setVariants((vs) => [...vs, emptyVariantRow()]);
  }
  function removeVariant(key: string) {
    setVariants((vs) => (vs.length > 1 ? vs.filter((v) => v.key !== key) : vs));
  }

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/products', {
        name: form.name,
        // brand/group opcionais: enviar undefined quando vazio para não falhar no Zod (min(1))
        brand: form.brand.trim() || undefined,
        group: form.group.trim() || undefined,
        subgroup: form.subgroup.trim() || undefined,
        tracksLotValidity,
        variants: variants.map((v) => ({
          sku: v.sku,
          barcode: v.barcode.trim() || undefined,
          description: v.description.trim() || undefined,
          costPrice: v.cost,
          averageCost: v.averageCost,
          salePrice: v.salePrice,
          stockQty: Number(v.stockQty) || 0,
          batch: v.batch.trim() || undefined,
          validity: v.validity || undefined,
        })),
      }),
    onSuccess: onCreated,
  });

  function submit() {
    const productSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório'),
      brand: brandRequired ? z.string().min(1, 'Marca é obrigatória') : z.string(),
      group: groupRequired ? z.string().min(1, 'Grupo é obrigatório') : z.string(),
      subgroup: subgroupRequired ? z.string().min(1, 'Subgrupo é obrigatório') : z.string(),
    });
    const variantSchema = buildVariantSchema(barcodeRequired, tracksLotValidity, requireAverageCost);

    const productResult = productSchema.safeParse(form);
    let hasErrors = false;
    if (!productResult.success) {
      setProductErrors(toFieldErrors(productResult.error.issues));
      hasErrors = true;
    } else {
      setProductErrors({});
    }

    const newVariantErrors: Record<string, Record<string, string>> = {};
    for (const v of variants) {
      const result = variantSchema.safeParse({
        sku: v.sku,
        barcode: v.barcode,
        costPrice: v.cost,
        averageCost: v.averageCost,
        salePrice: v.salePrice,
        batch: v.batch,
        validity: v.validity,
      });
      if (!result.success) {
        newVariantErrors[v.key] = toFieldErrors(result.error.issues);
        hasErrors = true;
      }
    }
    setVariantErrors(newVariantErrors);

    if (!hasErrors) create.mutate();
  }

  return createPortal(
    <div className="modal-overlay">
      <form
        className="modal-sheet sm:max-w-3xl flex flex-col overflow-hidden !p-0"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        {/* Cabeçalho fixo */}
        <div className="shrink-0 flex items-center gap-3 p-6 pb-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Novo produto</h2>
            <p className="text-sm text-slate-500">
              Cadastre o produto e uma ou mais variantes (ex.: 50ml/100ml, cores diferentes).
            </p>
          </div>
        </div>

        {/* Corpo com scroll interno — min-h-0 é obrigatório para o flexbox não estourar o wrapper */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={productErrors.name} value={form.name} onChange={set('name')} />
            <Field label="Marca" required={brandRequired} error={productErrors.brand} value={form.brand} onChange={set('brand')} />
            <Field label="Grupo" required={groupRequired} error={productErrors.group} value={form.group} onChange={set('group')} />
            <Field label="Subgrupo" required={subgroupRequired} error={productErrors.subgroup} value={form.subgroup} onChange={set('subgroup')} />
          </div>

          {/* Controle de lote e validade (Requisito 4.1 configurável) — vale para todas as variantes */}
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-brand-600"
              checked={tracksLotValidity}
              onChange={(e) => setTracksLotValidity(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold text-slate-700">Controlar lote e validade</span>
              <span className="block text-xs text-slate-500">
                Quando ativado, lote e validade tornam-se obrigatórios em cada variante.
              </span>
            </span>
          </label>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Variantes ({variants.length})
            </span>
            <button type="button" className="btn-ghost h-8 px-3 text-sm" onClick={addVariant}>
              <Plus className="h-4 w-4" /> Adicionar variante
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {variants.map((v, idx) => (
              <div key={v.key} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Variante {idx + 1}
                  </span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => removeVariant(v.key)}
                    disabled={variants.length <= 1}
                    title="Remover variante"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="SKU"
                    required
                    error={variantErrors[v.key]?.sku}
                    value={v.sku}
                    onChange={(e) => updateVariant(v.key, { sku: e.target.value })}
                  />
                  <Field
                    label="Código de barras"
                    required={barcodeRequired}
                    error={variantErrors[v.key]?.barcode}
                    value={v.barcode}
                    onChange={(e) => updateVariant(v.key, { barcode: e.target.value })}
                  />
                  <Field
                    label="Descrição da variante"
                    value={v.description}
                    onChange={(e) => updateVariant(v.key, { description: e.target.value })}
                  />
                  <Field
                    label="Estoque inicial"
                    type="number"
                    value={v.stockQty}
                    onChange={(e) => updateVariant(v.key, { stockQty: e.target.value })}
                  />
                </div>

                {tracksLotValidity && (
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Lote"
                      required
                      error={variantErrors[v.key]?.batch}
                      value={v.batch}
                      onChange={(e) => updateVariant(v.key, { batch: e.target.value })}
                    />
                    <Field
                      label="Validade"
                      required
                      type="date"
                      error={variantErrors[v.key]?.validity}
                      value={v.validity}
                      onChange={(e) => updateVariant(v.key, { validity: e.target.value })}
                    />
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                  <div className="mb-2 text-sm font-semibold text-brand-700">
                    Precificação — {pricingMode === 'margin' ? 'Margem sobre venda' : 'Markup sobre custo'}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <NumField
                      label="Último custo (R$)"
                      required
                      error={variantErrors[v.key]?.costPrice}
                      value={v.cost}
                      onChange={(val) => applyVariantCost(v.key, val)}
                    />
                    <NumField
                      label="Custo médio (R$)"
                      required={requireAverageCost}
                      error={variantErrors[v.key]?.averageCost}
                      value={v.averageCost}
                      onChange={(val) => updateVariant(v.key, { averageCost: val })}
                    />
                    <NumField
                      label={pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}
                      value={v.pct}
                      max={pricingMode === 'margin' ? 99.99 : undefined}
                      onChange={(val) => applyVariantPct(v.key, val)}
                    />
                    <NumField
                      label="Venda (R$)"
                      required
                      error={variantErrors[v.key]?.salePrice}
                      value={v.salePrice}
                      onChange={(val) => applyVariantSalePrice(v.key, val)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {create.error instanceof ApiError && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {(create.error as ApiError).message}
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 p-6 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Salvando...' : `Salvar produto (${variants.length} variante${variants.length > 1 ? 's' : ''})`}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Edição de produto + variantes
// ---------------------------------------------------------------------------
function EditProductModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [group, setGroup] = useState(product.group);
  const [subgroup, setSubgroup] = useState(product.subgroup ?? '');
  const [tracksLotValidity, setTracksLotValidity] = useState(product.tracksLotValidity);
  const [variants, setVariants] = useState(
    product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      description: v.description,
      barcode: v.barcode ?? '',
      costPrice: v.costPrice,
      averageCost: v.averageCost,
      salePrice: v.salePrice,
      batch: v.batch ?? '',
      validity: v.validity ? v.validity.slice(0, 10) : '',
    })),
  );

  const setVariant = (id: string, patch: Partial<(typeof variants)[number]>) =>
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  // Configurações necessárias antes dos handlers de precificação.
  const { data: settings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const pricingMode = settings?.pricingMode ?? 'margin';

  // Precificação: o pct (margem ou markup) é derivado de costPrice/salePrice no render.
  // Os handlers recalculam salePrice a partir do pct corrente, sem estado extra.
  function applyVCost(id: string, newCost: number) {
    setVariants((vs) => vs.map((v) => {
      if (v.id !== id) return v;
      const curPct = pricingMode === 'margin'
        ? Math.min(marginFromPrice(v.costPrice, v.salePrice) || 0, 99.99)
        : markupFromPrice(v.costPrice, v.salePrice) || 0;
      const newSale = pricingMode === 'margin'
        ? priceFromMargin(newCost, curPct)
        : priceFromMarkup(newCost, curPct);
      return { ...v, costPrice: newCost, salePrice: newSale };
    }));
  }
  function applyVPct(id: string, newPct: number) {
    setVariants((vs) => vs.map((v) => {
      if (v.id !== id) return v;
      const safe = pricingMode === 'margin' ? Math.min(newPct, 99.99) : newPct;
      const newSale = pricingMode === 'margin'
        ? priceFromMargin(v.costPrice, safe)
        : priceFromMarkup(v.costPrice, safe);
      return { ...v, salePrice: newSale };
    }));
  }
  function applyVSalePrice(id: string, newSale: number) {
    setVariants((vs) => vs.map((v) => (v.id !== id ? v : { ...v, salePrice: newSale })));
  }

  const brandRequired = settings?.brandRequired ?? false;
  const groupRequired = settings?.groupRequired ?? false;
  const subgroupRequired = settings?.subgroupRequired ?? false;
  const barcodeRequired = settings?.barcodeRequired ?? false;
  const requireAverageCost = settings?.requireAverageCost ?? false;

  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, Record<string, string>>>({});

  function handleSave() {
    const productSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório'),
      brand: brandRequired ? z.string().min(1, 'Marca é obrigatória') : z.string(),
      group: groupRequired ? z.string().min(1, 'Grupo é obrigatório') : z.string(),
      subgroup: subgroupRequired ? z.string().min(1, 'Subgrupo é obrigatório') : z.string(),
    });
    const varSchema = buildVariantSchema(barcodeRequired, tracksLotValidity, requireAverageCost);

    const productResult = productSchema.safeParse({ name, brand, group, subgroup });
    let hasErrors = false;
    if (!productResult.success) {
      setProductErrors(toFieldErrors(productResult.error.issues));
      hasErrors = true;
    } else {
      setProductErrors({});
    }

    const newVarErrors: Record<string, Record<string, string>> = {};
    for (const v of variants) {
      const vResult = varSchema.safeParse({
        sku: v.sku,
        barcode: v.barcode,
        costPrice: v.costPrice,
        averageCost: v.averageCost,
        salePrice: v.salePrice,
        batch: v.batch,
        validity: v.validity,
      });
      if (!vResult.success) {
        newVarErrors[v.id] = toFieldErrors(vResult.error.issues);
        hasErrors = true;
      }
    }
    setVariantErrors(newVarErrors);

    if (!hasErrors) save.mutate();
  }

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/products/${product.id}`, {
        name,
        brand: brand || undefined,
        group: group || undefined,
        subgroup: subgroup || null,
        tracksLotValidity,
      });
      for (const v of variants) {
        await api.put(`/api/products/variants/${v.id}`, {
          sku: v.sku,
          description: v.description.trim() || undefined,
          barcode: v.barcode || null,
          costPrice: v.costPrice,
          averageCost: v.averageCost,
          salePrice: v.salePrice,
          batch: v.batch || undefined,
          validity: v.validity || undefined,
        });
      }
    },
    onSuccess: onSaved,
  });

  return createPortal(
    <div className="modal-overlay">
      <form
        className="modal-sheet sm:max-w-2xl flex flex-col overflow-hidden !p-0"
        onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      >
        {/* Cabeçalho fixo */}
        <div className="shrink-0 flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <Pencil className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">
                Editar produto <span className="text-brand-500">#{product.code}</span>
              </h2>
              <p className="text-sm text-slate-500">Altere os dados e os preços das variantes.</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com scroll interno — min-h-0 impede o flexbox de estourar o wrapper */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nome"
              required
              error={productErrors.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Field
              label="Marca"
              required={brandRequired}
              error={productErrors.brand}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <Field
              label="Grupo"
              required={groupRequired}
              error={productErrors.group}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            />
            <Field
              label="Subgrupo"
              required={subgroupRequired}
              error={productErrors.subgroup}
              value={subgroup}
              onChange={(e) => setSubgroup(e.target.value)}
            />
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-600"
              checked={tracksLotValidity}
              onChange={(e) => setTracksLotValidity(e.target.checked)}
            />
            <span className="text-sm font-semibold text-slate-700">Controlar lote e validade</span>
          </label>

          <div className="mt-4 space-y-3">
            {variants.map((v) => (
              <div key={v.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Variante
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="SKU"
                    required
                    error={variantErrors[v.id]?.sku}
                    value={v.sku}
                    onChange={(e) => setVariants((vs) => vs.map((x) => x.id === v.id ? { ...x, sku: e.target.value } : x))}
                  />
                  <Field
                    label="Descrição"
                    value={v.description}
                    onChange={(e) => setVariant(v.id, { description: e.target.value })}
                  />
                  <Field
                    label="Código de barras"
                    required={barcodeRequired}
                    error={variantErrors[v.id]?.barcode}
                    value={v.barcode}
                    onChange={(e) => setVariant(v.id, { barcode: e.target.value })}
                  />
                  <NumField
                    label="Último custo (R$)"
                    required
                    error={variantErrors[v.id]?.costPrice}
                    value={v.costPrice}
                    onChange={(val) => applyVCost(v.id, val)}
                  />
                  <NumField
                    label="Custo médio (R$)"
                    required={requireAverageCost}
                    error={variantErrors[v.id]?.averageCost}
                    value={v.averageCost}
                    onChange={(val) => setVariant(v.id, { averageCost: val })}
                  />
                  <NumField
                    label={pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}
                    value={pricingMode === 'margin'
                      ? marginFromPrice(v.costPrice, v.salePrice) || 0
                      : markupFromPrice(v.costPrice, v.salePrice) || 0}
                    max={pricingMode === 'margin' ? 99.99 : undefined}
                    onChange={(val) => applyVPct(v.id, val)}
                  />
                  <NumField
                    label="Venda (R$)"
                    required
                    error={variantErrors[v.id]?.salePrice}
                    value={v.salePrice}
                    onChange={(val) => applyVSalePrice(v.id, val)}
                  />
                  {tracksLotValidity && (
                    <>
                      <Field
                        label="Lote"
                        required
                        error={variantErrors[v.id]?.batch}
                        value={v.batch}
                        onChange={(e) => setVariant(v.id, { batch: e.target.value })}
                      />
                      <Field
                        label="Validade"
                        required
                        type="date"
                        error={variantErrors[v.id]?.validity}
                        value={v.validity}
                        onChange={(e) => setVariant(v.id, { validity: e.target.value })}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {save.error instanceof ApiError && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {save.error.message}
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 p-6 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
/** Texto de label com marcação de campo obrigatório (* em vermelho). */
function Lbl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="label">
      {children}
      {required && <span className="text-rose-500"> *</span>}
    </span>
  );
}

function Field({
  label,
  required,
  error,
  ...props
}: { label: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <Lbl required={required}>{label}</Lbl>
      <input
        className={`input${error ? ' border-rose-400 focus:border-rose-400 focus:ring-rose-200' : ''}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
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

function NumField({
  label,
  value,
  required,
  error,
  max,
  onChange,
}: {
  label: string;
  value: number;
  required?: boolean;
  error?: string;
  max?: number;
  onChange: (v: number) => void;
}) {
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');
  const [raw, setRaw] = useState(() => toRaw(value));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(toRaw(value));
  }, [value]);

  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        className={`input${error ? ' border-rose-400 focus:border-rose-400 focus:ring-rose-200' : ''}`}
        type="text"
        inputMode="decimal"
        value={raw}
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
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  );
}
