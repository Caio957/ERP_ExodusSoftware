import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductFormSettings } from '@exodus/shared';
import { Settings, Save, Check, Package } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const defaults: ProductFormSettings = {
  subgroupRequired: false,
  barcodeRequired: false,
  defaultTracksLotValidity: false,
};

export function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductFormSettings>(defaults);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'product-form'],
    queryFn: () => api.get<ProductFormSettings>('/api/settings/product-form'),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put<ProductFormSettings>('/api/settings/product-form', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'product-form'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  const toggle = (k: keyof ProductFormSettings) => setForm((f) => ({ ...f, [k]: !f[k] }));

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
          <Settings className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="text-sm text-slate-500">Personalize o comportamento do sistema (somente ADMIN).</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2 font-semibold">
          <Package className="h-5 w-5 text-brand-600" /> Cadastro de produto — campos obrigatórios
        </div>
        <div className="divide-y divide-slate-100">
          <ToggleRow
            label="Exigir subgrupo"
            desc="Torna o campo Subgrupo obrigatório ao cadastrar produtos."
            checked={form.subgroupRequired}
            onChange={() => toggle('subgroupRequired')}
          />
          <ToggleRow
            label="Exigir código de barras"
            desc="Torna o campo Código de barras obrigatório ao cadastrar produtos."
            checked={form.barcodeRequired}
            onChange={() => toggle('barcodeRequired')}
          />
          <ToggleRow
            label="Controlar lote e validade por padrão"
            desc="Novos produtos já vêm com o controle de lote/validade ativado."
            checked={form.defaultTracksLotValidity}
            onChange={() => toggle('defaultTracksLotValidity')}
          />
        </div>

        {save.error instanceof ApiError && (
          <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {save.error.message}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Salvo!
            </span>
          )}
          <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
            <Save className="h-5 w-5" /> {save.isPending ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <div className="font-medium text-slate-800">{label}</div>
        <div className="text-sm text-slate-500">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-brand-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
