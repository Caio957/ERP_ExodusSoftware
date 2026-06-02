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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="input flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto, marca ou SKU..."
        />
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Novo produto
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-slate-500">Carregando...</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((p) => (
            <div key={p.id} className="card">
              <div className="text-xs text-slate-400">
                {p.brand} · {p.group}
              </div>
              <div className="font-semibold">{p.name}</div>
              <ul className="mt-2 space-y-1 text-sm">
                {p.variants.map((v) => (
                  <li key={v.id} className="flex justify-between">
                    <span className="text-slate-600">{v.description}</span>
                    <span className="font-medium">
                      {brl(v.salePrice)} · {v.stockQty}un
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data?.items.length === 0 && (
            <p className="col-span-full py-8 text-center text-slate-400">Nenhum produto encontrado.</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5">
        <h2 className="mb-4 text-lg font-bold">Novo produto</h2>

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

        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-600">Precificação</div>
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
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
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
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
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
