import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marginFromPrice,
  markupFromPrice,
  marginToMarkup,
  markupToMargin,
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
    <div className="space-y-5">
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
  const [localError, setLocalError] = useState<string | null>(null);

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

  // Precificação (Requisito 4.1). Fonte da verdade: custo + último percentual
  // informado (margem OU markup) recalcula o preço de venda. Editar a venda
  // diretamente recalcula ambos os percentuais.
  const [cost, setCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [margin, setMargin] = useState(0);
  const [markup, setMarkup] = useState(0);
  const [lastPct, setLastPct] = useState<'margin' | 'markup' | null>(null);

  function applyCost(novoCusto: number) {
    setCost(novoCusto);
    // Mantém o último percentual informado e recalcula a venda.
    if (lastPct === 'margin') setSalePrice(priceFromMargin(novoCusto, margin));
    else if (lastPct === 'markup') setSalePrice(priceFromMarkup(novoCusto, markup));
    else {
      setMargin(marginFromPrice(novoCusto, salePrice));
      setMarkup(markupFromPrice(novoCusto, salePrice));
    }
  }
  function applyMargin(v: number) {
    setLastPct('margin');
    setMargin(v);
    setMarkup(marginToMarkup(v));
    setSalePrice(priceFromMargin(cost, v));
  }
  function applyMarkup(v: number) {
    setLastPct('markup');
    setMarkup(v);
    setMargin(markupToMargin(v));
    setSalePrice(priceFromMarkup(cost, v));
  }
  function applySalePrice(v: number) {
    setLastPct(null);
    setSalePrice(v);
    setMargin(marginFromPrice(cost, v));
    setMarkup(markupFromPrice(cost, v));
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
    setLocalError(null);
    if (brandRequired && !form.brand.trim()) {
      setLocalError('Marca é obrigatória (definido nas Configurações).');
      return;
    }
    if (groupRequired && !form.group.trim()) {
      setLocalError('Grupo é obrigatório (definido nas Configurações).');
      return;
    }
    if (subgroupRequired && !form.subgroup.trim()) {
      setLocalError('Subgrupo é obrigatório (definido nas Configurações).');
      return;
    }
    if (barcodeRequired && !form.barcode.trim()) {
      setLocalError('Código de barras é obrigatório (definido nas Configurações).');
      return;
    }
    if (tracksLotValidity && (!form.batch.trim() || !form.validity)) {
      setLocalError('Lote e validade são obrigatórios quando o controle está ativado.');
      return;
    }
    create.mutate();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Novo produto</h2>
            <p className="text-sm text-slate-500">Cadastre o produto e a primeira variante.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" required value={form.name} onChange={set('name')} />
          <Field label="Marca" required={brandRequired} value={form.brand} onChange={set('brand')} />
          <Field label="Grupo" required={groupRequired} value={form.group} onChange={set('group')} />
          <Field label="Subgrupo" required={subgroupRequired} value={form.subgroup} onChange={set('subgroup')} />
          <Field label="SKU" required value={form.sku} onChange={set('sku')} />
          <Field
            label="Código de barras"
            required={barcodeRequired}
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
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Lote" required value={form.batch} onChange={set('batch')} />
            <Field label="Validade" required type="date" value={form.validity} onChange={set('validity')} />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="mb-2 text-sm font-semibold text-brand-700">Precificação (margem ⇄ markup)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField label="Custo (R$)" required value={cost} onChange={applyCost} />
            <NumField label="Margem (%)" value={margin} onChange={applyMargin} />
            <NumField label="Markup (%)" value={markup} onChange={applyMarkup} />
            <NumField label="Venda (R$)" required value={salePrice} onChange={applySalePrice} />
          </div>
        </div>

        {(localError || create.error instanceof ApiError) && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {localError ?? (create.error as ApiError).message}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={create.isPending} onClick={submit}>
            {create.isPending ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </div>
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

  // Configurações de obrigatoriedade (para marcar os campos com *).
  const { data: settings } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });
  const brandRequired = settings?.brandRequired ?? false;
  const groupRequired = settings?.groupRequired ?? false;
  const subgroupRequired = settings?.subgroupRequired ?? false;
  const barcodeRequired = settings?.barcodeRequired ?? false;

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
      <div className="modal-sheet sm:max-w-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-600">
              <Pencil className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">Editar produto</h2>
              <p className="text-sm text-slate-500">Altere os dados e os preços das variantes.</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Lbl required>Nome</Lbl>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <Lbl required={brandRequired}>Marca</Lbl>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </label>
          <label className="block">
            <Lbl required={groupRequired}>Grupo</Lbl>
            <input className="input" value={group} onChange={(e) => setGroup(e.target.value)} />
          </label>
          <label className="block">
            <Lbl required={subgroupRequired}>Subgrupo</Lbl>
            <input className="input" value={subgroup} onChange={(e) => setSubgroup(e.target.value)} />
          </label>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Lbl>Descrição</Lbl>
                  <input
                    className="input"
                    value={v.description}
                    onChange={(e) => setVariant(v.id, { description: e.target.value })}
                  />
                </label>
                <label className="block">
                  <Lbl required={barcodeRequired}>Código de barras</Lbl>
                  <input
                    className="input"
                    value={v.barcode}
                    onChange={(e) => setVariant(v.id, { barcode: e.target.value })}
                  />
                </label>
                <NumField
                  label="Custo (R$)"
                  required
                  value={v.costPrice}
                  onChange={(val) => setVariant(v.id, { costPrice: val })}
                />
                <NumField
                  label="Venda (R$)"
                  required
                  value={v.salePrice}
                  onChange={(val) => setVariant(v.id, { salePrice: val })}
                />
                {tracksLotValidity && (
                  <>
                    <label className="block">
                      <Lbl required>Lote</Lbl>
                      <input
                        className="input"
                        value={v.batch}
                        onChange={(e) => setVariant(v.id, { batch: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <Lbl required>Validade</Lbl>
                      <input
                        className="input"
                        type="date"
                        value={v.validity}
                        onChange={(e) => setVariant(v.id, { validity: e.target.value })}
                      />
                    </label>
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

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
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
  ...props
}: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <Lbl required={required}>{label}</Lbl>
      <input className="input" {...props} />
    </label>
  );
}

function NumField({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: number;
  required?: boolean;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(() => (value !== 0 ? String(value) : ''));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(value !== 0 ? String(value) : '');
  }, [value]);

  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        className="input"
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
      />
    </label>
  );
}
