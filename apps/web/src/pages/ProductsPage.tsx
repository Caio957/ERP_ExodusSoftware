import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marginFromPrice,
  markupFromPrice,
  marginToMarkup,
  markupToMargin,
  priceFromMargin,
  priceFromMarkup,
} from '@exodus/shared';
import { Plus, Search, Package, Tag } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ProductList {
  items: Array<{
    id: string;
    name: string;
    brand: string;
    group: string;
    variants: Array<{ id: string; sku: string; description: string; salePrice: number; stockQty: number }>;
  }>;
}

export function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => api.get<ProductList>(`/api/products?search=${encodeURIComponent(search)}`),
  });

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

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-12"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto, marca ou SKU..."
        />
      </div>

      {isLoading ? (
        <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((p) => (
            <div key={p.id} className="card-hover">
              <div className="mb-2 flex items-center gap-2">
                <span className="badge-brand">{p.brand}</span>
                <span className="badge-neutral">{p.group}</span>
              </div>
              <div className="font-display text-base font-bold">{p.name}</div>
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
                <p className="text-sm text-slate-400">Cadastre o primeiro produto da loja.</p>
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
            qc.invalidateQueries({ queryKey: ['products'] });
          }}
        />
      )}
    </div>
  );
}

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
  // Precificação com cálculo bidirecional (Requisito 4.1)
  const [cost, setCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [margin, setMargin] = useState(0);
  const [markup, setMarkup] = useState(0);

  function recomputeFromPrice(c: number, p: number) {
    setMargin(marginFromPrice(c, p));
    setMarkup(markupFromPrice(c, p));
  }

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/products', {
        name: form.name,
        brand: form.brand,
        group: form.group,
        subgroup: form.subgroup || undefined,
        variants: [
          {
            sku: form.sku,
            barcode: form.barcode || undefined,
            description: form.description,
            costPrice: cost,
            salePrice,
            stockQty: Number(form.stockQty) || 0,
            batch: form.batch,
            validity: form.validity,
          },
        ],
      }),
    onSuccess: onCreated,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl animate-scale-in overflow-auto rounded-2xl bg-white p-6 shadow-elevated">
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
          <Field label="Nome" value={form.name} onChange={set('name')} />
          <Field label="Marca" value={form.brand} onChange={set('brand')} />
          <Field label="Grupo" value={form.group} onChange={set('group')} />
          <Field label="Subgrupo (opcional)" value={form.subgroup} onChange={set('subgroup')} />
          <Field label="SKU" value={form.sku} onChange={set('sku')} />
          <Field label="Código de barras" value={form.barcode} onChange={set('barcode')} />
          <Field label="Descrição da variante" value={form.description} onChange={set('description')} />
          <Field label="Lote" value={form.batch} onChange={set('batch')} />
          <Field label="Validade" type="date" value={form.validity} onChange={set('validity')} />
          <Field label="Estoque inicial" type="number" value={form.stockQty} onChange={set('stockQty')} />
        </div>

        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="mb-2 text-sm font-semibold text-brand-700">Precificação (margem ⇄ markup)</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField
              label="Custo (R$)"
              value={cost}
              onChange={(v) => {
                setCost(v);
                recomputeFromPrice(v, salePrice);
              }}
            />
            <NumField
              label="Margem (%)"
              value={margin}
              onChange={(v) => {
                setMargin(v);
                setMarkup(marginToMarkup(v));
                setSalePrice(priceFromMargin(cost, v));
              }}
            />
            <NumField
              label="Markup (%)"
              value={markup}
              onChange={(v) => {
                setMarkup(v);
                setMargin(markupToMargin(v));
                setSalePrice(priceFromMarkup(cost, v));
              }}
            />
            <NumField
              label="Venda (R$)"
              value={salePrice}
              onChange={(v) => {
                setSalePrice(v);
                recomputeFromPrice(cost, v);
              }}
            />
          </div>
        </div>

        {create.error instanceof ApiError && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {create.error.message}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
