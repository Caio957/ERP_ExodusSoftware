import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUserSchema, type ProductFormSettings, type CompanyProfile, type PaymentType, type SalesSettings } from '@exodus/shared';
import { Settings, Save, Check, Package, CreditCard, Building2, Plus, Trash2, Users, Pencil, X, ShieldCheck, UserCheck, Search } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';

export function SettingsPage() {
  const [tab, setTab] = useState<'produto' | 'recebimentos' | 'empresa' | 'usuarios' | 'vendas'>('produto');
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
        <button className={tab === 'usuarios' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('usuarios')}>
          <Users className="h-5 w-5" /> Usuários
        </button>
        <button className={tab === 'vendas' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('vendas')}>
          <UserCheck className="h-5 w-5" /> Vendas
        </button>
      </div>

      {tab === 'produto' && <ProductFormSettingsCard />}
      {tab === 'recebimentos' && <PaymentTypesCard />}
      {tab === 'empresa' && <CompanyCard />}
      {tab === 'usuarios' && <UsersCard />}
      {tab === 'vendas' && <SalesSettingsCard />}
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
  requireAverageCost: false,
  pricingMode: 'margin',
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

  const toggle = (k: keyof Omit<ProductFormSettings, 'pricingMode'>) => setForm((f) => ({ ...f, [k]: !f[k] }));
  const setPricingMode = (mode: 'margin' | 'markup') => setForm((f) => ({ ...f, pricingMode: mode }));
  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card space-y-5">
      <div>
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Package className="h-5 w-5 text-brand-600" /> Campos obrigatórios
        </div>
        <div className="divide-y divide-slate-100">
          <ToggleRow label="Exigir marca" desc="Torna o campo Marca obrigatório." checked={form.brandRequired} onChange={() => toggle('brandRequired')} />
          <ToggleRow label="Exigir grupo" desc="Torna o campo Grupo obrigatório." checked={form.groupRequired} onChange={() => toggle('groupRequired')} />
          <ToggleRow label="Exigir subgrupo" desc="Torna o campo Subgrupo obrigatório." checked={form.subgroupRequired} onChange={() => toggle('subgroupRequired')} />
          <ToggleRow label="Exigir código de barras" desc="Torna o código de barras obrigatório." checked={form.barcodeRequired} onChange={() => toggle('barcodeRequired')} />
          <ToggleRow label="Controlar lote/validade por padrão" desc="Novos produtos já vêm com o controle ativado." checked={form.defaultTracksLotValidity} onChange={() => toggle('defaultTracksLotValidity')} />
          <ToggleRow label="Exigir Custo Médio" desc="Torna o preenchimento do custo médio obrigatório no cadastro e edição de produtos." checked={form.requireAverageCost} onChange={() => toggle('requireAverageCost')} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-1 text-sm font-semibold text-slate-700">Modelo de precificação</div>
        <p className="mb-3 text-xs text-slate-500">
          Define o campo de percentual exibido no formulário de produto.
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="pricingMode"
              className="mt-0.5 accent-brand-600"
              checked={form.pricingMode === 'margin'}
              onChange={() => setPricingMode('margin')}
            />
            <span className="text-sm">
              <span className="font-medium">Margem (%)</span>
              <span className="block text-xs text-slate-500">Lucro calculado sobre o preço de venda — ex.: vender por R$100 com 30% de margem → lucro de R$30</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="pricingMode"
              className="mt-0.5 accent-brand-600"
              checked={form.pricingMode === 'markup'}
              onChange={() => setPricingMode('markup')}
            />
            <span className="text-sm">
              <span className="font-medium">Markup (%)</span>
              <span className="block text-xs text-slate-500">Lucro calculado sobre o custo — ex.: custo R$70, markup 43%: preço de venda ≈ R$100</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
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
// Cliente padrão de vendas (substitui o fallback hardcoded "Balcão")
// ---------------------------------------------------------------------------
interface DefaultPerson {
  id: string;
  name: string;
  tradeName: string | null;
}

function SalesSettingsCard() {
  const qc = useQueryClient();
  const [defaultPerson, setDefaultPerson] = useState<DefaultPerson | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'sales'],
    queryFn: () => api.get<SalesSettings & { defaultPerson: DefaultPerson | null }>('/api/settings/sales'),
  });
  useEffect(() => {
    if (data) setDefaultPerson(data.defaultPerson);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/api/settings/sales', { defaultPersonId: defaultPerson?.id ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'sales'] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao salvar'),
  });

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card">
      <div className="mb-1 flex items-center gap-2 font-semibold">
        <UserCheck className="h-5 w-5 text-brand-600" /> Cliente padrão de vendas
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Usado no PDV e na edição de vendas quando nenhum cliente é selecionado —
        substitui o antigo "Balcão" por um cliente real do cadastro.
      </p>

      <DefaultPersonPicker value={defaultPerson} onChange={setDefaultPerson} />

      <div className="mt-5 flex items-center justify-end gap-3">
        <SavedTag show={saved} />
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save className="h-5 w-5" /> {save.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function DefaultPersonPicker({
  value,
  onChange,
}: {
  value: DefaultPerson | null;
  onChange: (p: DefaultPerson | null) => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['settings-sales-person-search', term],
    queryFn: () =>
      api.get<{ items: DefaultPerson[] }>(
        `/api/persons?type=CLIENT&pageSize=20${term.trim() ? `&search=${encodeURIComponent(term.trim())}` : ''}`,
      ),
    enabled: !value,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <span className="font-medium">{value.name}{value.tradeName ? ` (${value.tradeName})` : ''}</span>
        <button className="text-xs underline" onClick={() => onChange(null)}>
          remover
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar cliente (nenhum padrão configurado)..."
        />
      </div>
      {data && data.items.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
          {data.items.map((p) => (
            <button
              key={p.id}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => onChange(p)}
            >
              {p.name}
              {p.tradeName && <span className="text-slate-400"> ({p.tradeName})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gerenciamento de Usuários
// ---------------------------------------------------------------------------
interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  allowedPages: string[] | null;
  createdAt: string;
}

const ALL_PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pdv', label: 'PDV' },
  { key: 'products', label: 'Produtos' },
  { key: 'stock', label: 'Estoque' },
  { key: 'cash', label: 'Caixa' },
  { key: 'registrations', label: 'Cadastros' },
  { key: 'sales', label: 'Vendas' },
  { key: 'purchases', label: 'Compras' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'settings', label: 'Configurações' },
];

const CASHIER_DEFAULT = ['pdv', 'products', 'cash', 'registrations'];

function UsersCard() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserRecord[]>('/api/auth/users'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/auth/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir'),
  });

  if (isLoading) return <div className="grid h-40 place-items-center text-slate-500">Carregando...</div>;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Users className="h-5 w-5 text-brand-600" /> Usuários do sistema
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> Novo usuário
        </button>
      </div>

      <div className="divide-y divide-slate-100">
        {data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-brand">
                {u.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {u.name}
                  {u.id === me?.id && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">você</span>}
                </div>
                <div className="text-xs text-slate-400">{u.email}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.role === 'ADMIN' ? 'bg-accent-100 text-accent-700' : 'bg-slate-100 text-slate-600'}`}>
                    {u.role === 'ADMIN' ? 'ADMIN' : 'OPERADOR'}
                  </span>
                  {u.role !== 'ADMIN' && u.allowedPages !== null && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                      {u.allowedPages?.length ?? 0} tela(s) personalizada(s)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                onClick={() => setEditing(u)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {u.id !== me?.id && (
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => {
                    if (window.confirm(`Excluir o usuário "${u.name}"? Esta ação não pode ser desfeita.`))
                      remove.mutate(u.id);
                  }}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {data?.length === 0 && (
          <div className="py-8 text-center text-slate-400">Nenhum usuário cadastrado.</div>
        )}
      </div>

      {creating && (
        <UserFormModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'CASHIER'>((user?.role as 'ADMIN' | 'CASHIER') ?? 'CASHIER');
  const [useCustomPages, setUseCustomPages] = useState(user ? user.allowedPages !== null : false);
  const [selectedPages, setSelectedPages] = useState<string[]>(
    user?.allowedPages ?? CASHIER_DEFAULT
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function togglePage(key: string) {
    setSelectedPages((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  }

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name, email, role };
      if (password.trim()) body.password = password;
      if (role === 'ADMIN') {
        body.allowedPages = null;
      } else {
        body.allowedPages = useCustomPages ? selectedPages : null;
      }
      if (isEdit) {
        return api.put(`/api/auth/users/${user!.id}`, body);
      } else {
        if (!password.trim()) throw new Error('Informe a senha.');
        return api.post('/api/auth/register', body);
      }
    },
    onSuccess: onSaved,
    onError: (e) => setLocalError(e instanceof ApiError ? e.message : (e as Error).message || 'Falha ao salvar'),
  });

  function submit() {
    setLocalError(null);
    if (name.trim().length < 2) return setLocalError('Nome deve ter pelo menos 2 caracteres.');
    if (!createUserSchema.shape.email.safeParse(email).success) return setLocalError('E-mail inválido.');
    if (!isEdit && password.trim().length < 8) return setLocalError('Senha deve ter ao menos 8 caracteres.');
    if (isEdit && password.trim() && password.trim().length < 8) return setLocalError('Nova senha deve ter ao menos 8 caracteres.');
    save.mutate();
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet sm:max-w-md flex flex-col overflow-hidden !p-0">
        {/* Cabeçalho fixo */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            {isEdit ? 'Editar usuário' : 'Novo usuário'}
          </h2>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com scroll interno — min-h-0 é obrigatório para o flexbox não estourar o wrapper */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
          <label className="block">
            <span className="label">Nome *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </label>
          <label className="block">
            <span className="label">E-mail *</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </label>
          <label className="block">
            <span className="label">{isEdit ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="label">Perfil *</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={role === 'ADMIN' ? 'btn-primary flex-1' : 'btn-ghost flex-1'}
                onClick={() => setRole('ADMIN')}
              >
                Administrador
              </button>
              <button
                type="button"
                className={role === 'CASHIER' ? 'btn-primary flex-1' : 'btn-ghost flex-1'}
                onClick={() => setRole('CASHIER')}
              >
                Operador
              </button>
            </div>
          </label>

          {role === 'CASHIER' && (
            <div className="rounded-xl border border-slate-200 p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-600"
                  checked={useCustomPages}
                  onChange={(e) => setUseCustomPages(e.target.checked)}
                />
                <div>
                  <div className="font-medium text-slate-800 text-sm">Personalizar telas acessíveis</div>
                  <div className="text-xs text-slate-500">
                    Sem personalização: PDV, Produtos, Caixa e Cadastros (padrão do Operador).
                  </div>
                </div>
              </label>

              {useCustomPages && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ALL_PAGES.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:bg-brand-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={selectedPages.includes(p.key)}
                        onChange={() => togglePage(p.key)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {localError && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{localError}</div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="shrink-0 flex justify-end gap-3 p-4 sm:p-6 border-t border-slate-100 bg-slate-50">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={save.isPending} onClick={submit}>
            {save.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
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
