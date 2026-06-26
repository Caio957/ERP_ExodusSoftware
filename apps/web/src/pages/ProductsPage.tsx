import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marginFromPrice,
  markupFromPrice,
  priceFromMargin,
  priceFromMarkup,
  type ProductFormSettings,
} from '@exodus/shared';
import { Plus, Search, Package, Tag, Pencil, Trash2, X, ShieldCheck, Filter } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Variant {
  id: string;
  sku: string;
  description: string;
  barcode: string | null;
  costPrice: number;
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
}

export function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [group, setGroup] = useState('');
  const [subgroup, setSubgroup] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, brand, group, subgroup],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (search.trim()) qs.set('search', search.trim());
      if (brand.trim()) qs.set('brand', brand.trim());
      if (group.trim()) qs.set('group', group.trim());
      if (subgroup.trim()) qs.set('subgroup', subgroup.trim());
      return api.get<ProductList>(`/api/products?${qs.toString()}`);
    },
  });

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
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="text-sm text-slate-500">Catálogo, preços e estoque da loja.</p>
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
        <div className="card grid animate-fade-in gap-3 sm:grid-cols-3">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schemas Zod dinâmicos — obrigatoriedade condicionada às configurações da loja
// ---------------------------------------------------------------------------
function buildProductFormSchema(
  brandRequired: boolean,
  groupRequired: boolean,
  subgroupRequired: boolean,
  barcodeRequired: boolean,
  tracksLotValidity: boolean,
) {
  return z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    brand: brandRequired ? z.string().min(1, 'Marca é obrigatória') : z.string(),
    group: groupRequired ? z.string().min(1, 'Grupo é obrigatório') : z.string(),
    subgroup: subgroupRequired ? z.string().min(1, 'Subgrupo é obrigatório') : z.string(),
    sku: z.string().min(1, 'SKU é obrigatório'),
    barcode: barcodeRequired ? z.string().min(1, 'Código de barras é obrigatório') : z.string(),
    cost: z.number({ invalid_type_error: 'Custo inválido' }).min(0.01, 'Custo deve ser maior que zero'),
    salePrice: z.number({ invalid_type_error: 'Preço inválido' }).min(0.01, 'Preço de venda deve ser maior que zero'),
    batch: tracksLotValidity ? z.string().min(1, 'Lote é obrigatório') : z.string(),
    validity: tracksLotValidity ? z.string().min(1, 'Validade é obrigatória') : z.string(),
  });
}

function buildVariantSchema(barcodeRequired: boolean, tracksLotValidity: boolean) {
  return z.object({
    sku: z.string().min(1, 'SKU é obrigatório'),
    barcode: barcodeRequired ? z.string().min(1, 'Código de barras é obrigatório') : z.string(),
    costPrice: z.number({ invalid_type_error: 'Custo inválido' }).min(0.01, 'Custo deve ser maior que zero'),
    salePrice: z.number({ invalid_type_error: 'Preço inválido' }).min(0.01, 'Preço de venda deve ser maior que zero'),
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
// Cadastro de novo produto
// ---------------------------------------------------------------------------
function ProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    brand: '',
    group: '',
    subgroup: '',
    sku: '',
    barcode: '',
    description: '',
    batch: '',
    validity: '',
    stockQty: '0',
  });
  const [tracksLotValidity, setTracksLotValidity] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Config da loja: define quais campos são obrigatórios (Onda 2).
  const { data: settings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const brandRequired = settings?.brandRequired ?? false;
  const groupRequired = settings?.groupRequired ?? false;
  const subgroupRequired = settings?.subgroupRequired ?? false;
  const barcodeRequired = settings?.barcodeRequired ?? false;
  // Lote/validade é sempre opt-in: todo produto novo abre desmarcado e quem
  // decide é o usuário, por produto. Não bloqueia o cadastro por causa de lote.

  // Precificação unificada: um único estado `pct` representa Margem OU Markup
  // conforme `pricingMode` lido das configurações da loja.
  const pricingMode = settings?.pricingMode ?? 'margin';
  const [cost, setCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [pct, setPct] = useState(0);

  function applyCost(novoCusto: number) {
    const safePct = pricingMode === 'margin' ? Math.min(pct, 99.99) : pct;
    setCost(novoCusto);
    setSalePrice(pricingMode === 'margin'
      ? priceFromMargin(novoCusto, safePct)
      : priceFromMarkup(novoCusto, safePct));
  }
  function applyPct(v: number) {
    const safe = pricingMode === 'margin' ? Math.min(v, 99.99) : v;
    setPct(safe);
    setSalePrice(pricingMode === 'margin'
      ? priceFromMargin(cost, safe)
      : priceFromMarkup(cost, safe));
  }
  function applySalePrice(v: number) {
    setSalePrice(v);
    setPct(pricingMode === 'margin'
      ? marginFromPrice(cost, v) || 0
      : markupFromPrice(cost, v) || 0);
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
        variants: [
          {
            sku: form.sku,
            barcode: form.barcode || undefined,
            description: form.description.trim() || undefined,
            costPrice: cost,
            salePrice,
            stockQty: Number(form.stockQty) || 0,
            batch: form.batch || undefined,
            validity: form.validity || undefined,
          },
        ],
      }),
    onSuccess: onCreated,
  });

  function submit() {
    const schema = buildProductFormSchema(
      brandRequired, groupRequired, subgroupRequired, barcodeRequired, tracksLotValidity,
    );
    const result = schema.safeParse({
      name: form.name,
      brand: form.brand,
      group: form.group,
      subgroup: form.subgroup,
      sku: form.sku,
      barcode: form.barcode,
      cost,
      salePrice,
      batch: form.batch,
      validity: form.validity,
    });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues));
      return;
    }
    setErrors({});
    create.mutate();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="modal-overlay">
      <form
        className="modal-sheet w-full !h-[95dvh] sm:!h-auto !max-h-[95dvh] sm:!max-h-[90vh] sm:max-w-2xl flex flex-col overflow-hidden !p-0"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        {/* Cabeçalho fixo */}
        <div className="shrink-0 flex items-center gap-3 p-6 pb-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Novo produto</h2>
            <p className="text-sm text-slate-500">Cadastre o produto e a primeira variante.</p>
          </div>
        </div>

        {/* Corpo com scroll interno — min-h-0 é obrigatório para o flexbox não estourar o wrapper */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.name} value={form.name} onChange={set('name')} />
            <Field label="Marca" required={brandRequired} error={errors.brand} value={form.brand} onChange={set('brand')} />
            <Field label="Grupo" required={groupRequired} error={errors.group} value={form.group} onChange={set('group')} />
            <Field label="Subgrupo" required={subgroupRequired} error={errors.subgroup} value={form.subgroup} onChange={set('subgroup')} />
            <Field label="SKU" required error={errors.sku} value={form.sku} onChange={set('sku')} />
            <Field
              label="Código de barras"
              required={barcodeRequired}
              error={errors.barcode}
              value={form.barcode}
              onChange={set('barcode')}
            />
            <Field label="Descrição da variante" value={form.description} onChange={set('description')} />
            <Field label="Estoque inicial" type="number" value={form.stockQty} onChange={set('stockQty')} />
          </div>

          {/* Controle de lote e validade (Requisito 4.1 configurável) */}
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
                Quando ativado, lote e validade tornam-se obrigatórios para este produto.
              </span>
            </span>
          </label>

          {tracksLotValidity && (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Lote" required error={errors.batch} value={form.batch} onChange={set('batch')} />
              <Field label="Validade" required type="date" error={errors.validity} value={form.validity} onChange={set('validity')} />
            </div>
          )}

          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
            <div className="mb-2 text-sm font-semibold text-brand-700">
              Precificação — {pricingMode === 'margin' ? 'Margem sobre venda' : 'Markup sobre custo'}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumField label="Custo (R$)" required error={errors.cost} value={cost} onChange={applyCost} />
              <NumField
                label={pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}
                value={pct}
                onChange={applyPct}
              />
              <NumField label="Venda (R$)" required error={errors.salePrice} value={salePrice} onChange={applySalePrice} />
            </div>
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
            {create.isPending ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </form>
    </div>
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

  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [variantErrors, setVariantErrors] = useState<Record<string, Record<string, string>>>({});

  function handleSave() {
    const productSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório'),
      brand: brandRequired ? z.string().min(1, 'Marca é obrigatória') : z.string(),
      group: groupRequired ? z.string().min(1, 'Grupo é obrigatório') : z.string(),
      subgroup: subgroupRequired ? z.string().min(1, 'Subgrupo é obrigatório') : z.string(),
    });
    const varSchema = buildVariantSchema(barcodeRequired, tracksLotValidity);

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
        brand,
        group,
        subgroup: subgroup || null,
        tracksLotValidity,
      });
      for (const v of variants) {
        await api.put(`/api/products/variants/${v.id}`, {
          sku: v.sku,
          description: v.description.trim() || undefined,
          barcode: v.barcode || null,
          costPrice: v.costPrice,
          salePrice: v.salePrice,
          batch: v.batch || undefined,
          validity: v.validity || undefined,
        });
      }
    },
    onSuccess: onSaved,
  });

  return (
    <div className="modal-overlay">
      <form
        className="modal-sheet w-full !h-[95dvh] sm:!h-auto !max-h-[95dvh] sm:!max-h-[90vh] sm:max-w-2xl flex flex-col overflow-hidden !p-0"
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
                    label="Custo (R$)"
                    required
                    error={variantErrors[v.id]?.costPrice}
                    value={v.costPrice}
                    onChange={(val) => applyVCost(v.id, val)}
                  />
                  <NumField
                    label={pricingMode === 'margin' ? 'Margem (%)' : 'Markup (%)'}
                    value={pricingMode === 'margin'
                      ? marginFromPrice(v.costPrice, v.salePrice) || 0
                      : markupFromPrice(v.costPrice, v.salePrice) || 0}
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
    </div>
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
  onChange,
}: {
  label: string;
  value: number;
  required?: boolean;
  error?: string;
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
          setRaw(cleaned);
          skipSync.current = true;
          onChange(parseFloat(cleaned.replace(',', '.')) || 0);
        }}
        onFocus={(e) => e.target.select()}
      />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  );
}
