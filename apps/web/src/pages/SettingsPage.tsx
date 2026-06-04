import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductFormSettings, CompanyProfile, PaymentType } from '@exodus/shared';
import { Settings, Save, Check, Package, CreditCard, Building2, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';

export function SettingsPage() {
  const [tab, setTab] = useState<'produto' | 'recebimentos' | 'empresa'>('produto');
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

      <div className="flex flex-wrap gap-2">
        <button className={tab === 'produto' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('produto')}>
          <Package className="h-5 w-5" /> Produto
        </button>
        <button className={tab === 'recebimentos' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('recebimentos')}>
          <CreditCard className="h-5 w-5" /> Recebimentos
        </button>
        <button className={tab === 'empresa' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('empresa')}>
          <Building2 className="h-5 w-5" /> Empresa
        </button>
      </div>

      {tab === 'produto' && <ProductFormSettingsCard />}
      {tab === 'recebimentos' && <PaymentTypesCard />}
      {tab === 'empresa' && <CompanyCard />}
    </div>
  );
}

function SavedTag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
      <Check className="h-4 w-4" /> Salvo!
    </span>
  );
}

// ---------------------------------------------------------------------------
const productDefaults: ProductFormSettings = {
  brandRequired: false,
  groupRequired: false,
  subgroupRequired: false,
  barcodeRequired: false,
  defaultTracksLotValidity: false,
};

function ProductFormSettingsCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductFormSettings>(productDefaults);
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
    <div className="card">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Package className="h-5 w-5 text-brand-600" /> Cadastro de produto — campos obrigatórios
      </div>
      <div className="divide-y divide-slate-100">
        <ToggleRow label="Exigir marca" desc="Torna o campo Marca obrigatório." checked={form.brandRequired} onChange={() => toggle('brandRequired')} />
        <ToggleRow label="Exigir grupo" desc="Torna o campo Grupo obrigatório." checked={form.groupRequired} onChange={() => toggle('groupRequired')} />
        <ToggleRow label="Exigir subgrupo" desc="Torna o campo Subgrupo obrigatório." checked={form.subgroupRequired} onChange={() => toggle('subgroupRequired')} />
        <ToggleRow label="Exigir código de barras" desc="Torna o código de barras obrigatório." checked={form.barcodeRequired} onChange={() => toggle('barcodeRequired')} />
        <ToggleRow label="Controlar lote/validade por padrão" desc="Novos produtos já vêm com o controle ativado." checked={form.defaultTracksLotValidity} onChange={() => toggle('defaultTracksLotValidity')} />
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        <SavedTag show={saved} />
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-5 w-5" /> {save.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function PaymentTypesCard() {
  const qc = useQueryClient();
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'payment-types'],
    queryFn: () => api.get<{ types: PaymentType[] }>('/api/settings/payment-types'),
  });
  useEffect(() => {
    if (data) setTypes(data.types);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/api/settings/payment-types', { types }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'payment-types'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  const isBase = (code: string) => ['CASH', 'PIX', 'DEBIT', 'CREDIT', 'A_PRAZO'].includes(code);

  function addType() {
    const label = newLabel.trim();
    if (label.length < 1) return;
    const code = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20);
    if (types.some((t) => t.code === code)) return window.alert('Já existe um tipo com esse código.');
    setTypes((prev) => [...prev, { code, label, kind: 'OTHER', active: true }]);
    setNewLabel('');
  }

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <CreditCard className="h-5 w-5 text-brand-600" /> Tipos de recebimento
      </div>
      <p className="mb-4 text-sm text-slate-500">Formas de pagamento disponíveis no PDV. Renomeie, ative/desative ou adicione novas.</p>

      <div className="space-y-2">
        {types.map((t, i) => (
          <div key={t.code} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
            <input
              className="input h-9 flex-1"
              value={t.label}
              onChange={(e) => setTypes((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <span className="hidden text-xs text-slate-400 sm:inline">{t.code}</span>
            {t.kind === 'A_PRAZO' && <span className="badge-warning">a prazo</span>}
            <button
              type="button"
              role="switch"
              aria-checked={t.active}
              onClick={() => setTypes((prev) => prev.map((x, j) => (j === i ? { ...x, active: !x.active } : x)))}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${t.active ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${t.active ? 'left-6' : 'left-1'}`} />
            </button>
            {!isBase(t.code) && (
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => setTypes((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="input h-10"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nova forma (ex.: Vale, Transferência)"
          onKeyDown={(e) => e.key === 'Enter' && addType()}
        />
        <button className="btn-ghost" onClick={addType}>
          <Plus className="h-5 w-5" /> Adicionar
        </button>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        <SavedTag show={saved} />
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-5 w-5" /> {save.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const companyDefaults: CompanyProfile = { name: '', document: '', phone: '', email: '', address: '' };

function CompanyCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState<CompanyProfile>(companyDefaults);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => api.get<CompanyProfile>('/api/settings/company'),
  });
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/api/settings/company', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'company'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  const set = (k: keyof CompanyProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Building2 className="h-5 w-5 text-brand-600" /> Dados da empresa
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="label">Nome / Razão social</span>
          <input className="input" value={form.name} onChange={set('name')} />
        </label>
        <label className="block">
          <span className="label">CNPJ / CPF</span>
          <input className="input" value={form.document} onChange={set('document')} />
        </label>
        <label className="block">
          <span className="label">Telefone</span>
          <input className="input" value={form.phone} onChange={set('phone')} />
        </label>
        <label className="col-span-2 block">
          <span className="label">E-mail</span>
          <input className="input" value={form.email} onChange={set('email')} />
        </label>
        <label className="col-span-2 block">
          <span className="label">Endereço</span>
          <input className="input" value={form.address} onChange={set('address')} />
        </label>
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        <SavedTag show={saved} />
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-5 w-5" /> {save.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
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
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}
